const API_URL = "api/visibility.php";
const AUTH_URL = "/OceanOS/api/auth.php";
const OCEANOS_URL = "/OceanOS/";

const $ = (id) => document.getElementById(id);

const elements = {
  loadingView: $("loading-view"),
  appView: $("app-view"),
  currentUser: $("current-user"),
  connectionPill: $("connection-pill"),
  appMessage: $("app-message"),
  aiPill: $("ai-pill"),
  logoutButton: $("logout-button"),
  startPanel: $("start-panel"),
  meetingStage: $("meeting-stage"),
  roomTitle: $("room-title"),
  roomCode: $("room-code"),
  sourceLanguage: $("source-language"),
  targetLanguage: $("target-language"),
  activeSourceLanguage: $("active-source-language"),
  activeTargetLanguage: $("active-target-language"),
  createRoomButton: $("create-room-button"),
  joinRoomButton: $("join-room-button"),
  recentRooms: $("recent-rooms"),
  activeRoomTitle: $("active-room-title"),
  activeRoomCode: $("active-room-code"),
  copyRoomButton: $("copy-room-button"),
  toggleMicButton: $("toggle-mic-button"),
  toggleCameraButton: $("toggle-camera-button"),
  shareScreenButton: $("share-screen-button"),
  leaveRoomButton: $("leave-room-button"),
  videoGrid: $("video-grid"),
  liveCaption: $("live-caption"),
  transcriptionToggle: $("transcription-toggle"),
  translationToggle: $("translation-toggle"),
  participantCount: $("participant-count"),
  participantList: $("participant-list"),
  transcriptList: $("transcript-list"),
  clearTranscriptButton: $("clear-transcript-button"),
};

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const state = {
  clientId: clientId(),
  currentUser: null,
  languages: {},
  ai: null,
  room: null,
  participants: [],
  localStream: null,
  cameraStream: null,
  screenStream: null,
  peers: new Map(),
  videoTiles: new Map(),
  transcriptMap: new Map(),
  lastSignalId: 0,
  lastTranscriptId: 0,
  syncTimer: null,
  pendingSync: false,
  sourceLanguage: "fr-FR",
  targetLanguage: "fr-FR",
  translationEnabled: true,
  transcriptionEnabled: true,
  media: {
    microphone: false,
    camera: false,
    screen: false,
    connectionState: "online",
  },
  recognition: null,
  recognitionActive: false,
  recognitionShouldRun: false,
  speechNoticeShown: false,
  transcriptFingerprints: [],
};

function clientId() {
  try {
    const existing = localStorage.getItem("meetocean_client_id");
    if (existing) return existing;
    const generated = crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "")
      : `me_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem("meetocean_client_id", generated);
    return generated;
  } catch (error) {
    return `me_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  }
}

function setVisible(ready) {
  elements.loadingView.classList.toggle("hidden", ready);
  elements.appView.classList.toggle("hidden", !ready);
}

function setMessage(message = "", type = "", action = null) {
  elements.appMessage.replaceChildren();
  if (message) {
    const text = document.createElement("span");
    text.textContent = message;
    elements.appMessage.appendChild(text);
  }
  if (action?.href && action?.label) {
    const link = document.createElement("a");
    link.className = "message-action";
    link.href = action.href;
    link.textContent = action.label;
    elements.appMessage.appendChild(link);
  }
  elements.appMessage.dataset.type = type;
  elements.appMessage.classList.toggle("hidden", message === "");
}

function isLoopbackHost(hostname = window.location.hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function localMeetOceanUrl() {
  const path = window.location.pathname.endsWith("/")
    ? window.location.pathname
    : `${window.location.pathname}/`;
  return `http://localhost${path}${window.location.search}${window.location.hash}`;
}

function secureMeetOceanUrl() {
  const url = new URL(window.location.href);
  url.protocol = "https:";
  return url.toString();
}

function insecureMediaAction() {
  if (window.isSecureContext) return null;
  if (!isLoopbackHost()) {
    return {
      href: secureMeetOceanUrl(),
      label: "Reessayer en HTTPS",
    };
  }
  return {
    href: localMeetOceanUrl(),
    label: "Ouvrir avec localhost",
  };
}

function showMediaSecurityMessage() {
  setMessage(mediaAccessMessage(), "error", insecureMediaAction());
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.message || payload.error || "Erreur MeetOcean.");
  }
  return payload;
}

function postAction(action, data = {}) {
  return requestJson(API_URL, {
    method: "POST",
    body: JSON.stringify({ action, ...data }),
  });
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function initials(name) {
  return String(name || "ME")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "ME";
}

function effectiveTargetLanguage() {
  return state.translationEnabled ? state.targetLanguage : state.sourceLanguage;
}

function mediaState(extra = {}) {
  return {
    microphone: state.media.microphone,
    camera: state.media.camera,
    screen: state.media.screen,
    connectionState: state.media.connectionState,
    ...extra,
  };
}

function populateLanguageSelect(select, selected) {
  select.innerHTML = "";
  Object.entries(state.languages).forEach(([code, label]) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = label;
    option.selected = code === selected;
    select.appendChild(option);
  });
}

function syncLanguageControls() {
  populateLanguageSelect(elements.sourceLanguage, state.sourceLanguage);
  populateLanguageSelect(elements.targetLanguage, state.targetLanguage);
  populateLanguageSelect(elements.activeSourceLanguage, state.sourceLanguage);
  populateLanguageSelect(elements.activeTargetLanguage, state.targetLanguage);
  elements.activeTargetLanguage.disabled = !state.translationEnabled;
}

function renderIdentity(payload) {
  const user = payload.currentUser || {};
  state.currentUser = user;
  state.ai = payload.ai || {};
  elements.currentUser.textContent = user.displayName || user.email || "Utilisateur";
  elements.aiPill.textContent = state.ai.hasApiKey ? "Traduction IA active" : "IA a configurer";
  elements.connectionPill.textContent = state.room ? "En reunion" : "Hors reunion";
}

function renderRecentRooms(rooms = []) {
  elements.recentRooms.innerHTML = "";
  if (!Array.isArray(rooms) || rooms.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state inline";
    empty.textContent = "Aucune reunion recente";
    elements.recentRooms.appendChild(empty);
    return;
  }

  rooms.forEach((room) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "room-row";
    button.dataset.code = room.code || "";

    const title = document.createElement("strong");
    title.textContent = room.title || "Reunion MeetOcean";
    const meta = document.createElement("span");
    meta.textContent = `${room.code || ""} - ${room.participantCount || 0} participant${Number(room.participantCount || 0) > 1 ? "s" : ""}`;

    button.append(title, meta);
    button.addEventListener("click", () => {
      elements.roomCode.value = room.code || "";
      void joinRoom();
    });
    elements.recentRooms.appendChild(button);
  });
}

function renderDashboard(payload) {
  state.languages = payload.languages || { "fr-FR": "Francais", "en-US": "Anglais" };
  state.sourceLanguage = payload.defaults?.sourceLanguage || "fr-FR";
  state.targetLanguage = payload.defaults?.targetLanguage || state.sourceLanguage;
  renderIdentity(payload);
  syncLanguageControls();
  renderRecentRooms(payload.recentRooms || []);
}

function setRoomActive(active) {
  elements.startPanel.classList.toggle("hidden", active);
  elements.meetingStage.classList.toggle("hidden", !active);
  elements.connectionPill.textContent = active ? "En reunion" : "Hors reunion";
}

function updateRoomHeader() {
  if (!state.room) return;
  elements.activeRoomTitle.textContent = state.room.title || "Reunion MeetOcean";
  elements.activeRoomCode.textContent = state.room.code || "---";
}

function participantByClient(clientIdValue) {
  return state.participants.find((participant) => participant.clientId === clientIdValue) || null;
}

function displayNameFor(clientIdValue) {
  if (clientIdValue === state.clientId) {
    return `${state.currentUser?.displayName || "Vous"} (vous)`;
  }
  return participantByClient(clientIdValue)?.displayName || "Invite";
}

function renderParticipants() {
  const participants = state.participants || [];
  elements.participantCount.textContent = String(participants.length);
  elements.participantList.innerHTML = "";

  if (participants.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state inline";
    empty.textContent = "Aucun participant";
    elements.participantList.appendChild(empty);
    return;
  }

  participants.forEach((participant) => {
    const row = document.createElement("article");
    row.className = "participant-item";

    const avatar = document.createElement("span");
    avatar.className = "avatar";
    avatar.textContent = initials(participant.displayName);

    const body = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = participant.clientId === state.clientId
      ? `${participant.displayName || "Vous"} (vous)`
      : participant.displayName || "Invite";
    const meta = document.createElement("span");
    const language = state.languages[participant.sourceLanguage] || participant.sourceLanguage || "";
    const media = [
      participant.microphoneEnabled ? "micro" : "muet",
      participant.cameraEnabled || participant.screenEnabled ? "video" : "sans video",
    ].join(" - ");
    meta.textContent = `${language} - ${media}`;
    body.append(name, meta);
    row.append(avatar, body);
    elements.participantList.appendChild(row);
  });
}

function ensureVideoTile(clientIdValue, label, stream, local = false) {
  let entry = state.videoTiles.get(clientIdValue);
  if (!entry) {
    const tile = document.createElement("article");
    tile.className = "video-tile";
    tile.dataset.clientId = clientIdValue;

    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.muted = local;

    const placeholder = document.createElement("div");
    placeholder.className = "video-placeholder";
    const avatar = document.createElement("span");
    avatar.textContent = initials(label);
    placeholder.appendChild(avatar);

    const meta = document.createElement("div");
    meta.className = "tile-meta";
    const name = document.createElement("strong");
    const status = document.createElement("span");
    meta.append(name, status);

    tile.append(video, placeholder, meta);
    elements.videoGrid.appendChild(tile);
    entry = { tile, video, placeholder, name, status };
    state.videoTiles.set(clientIdValue, entry);
  }

  if (entry.video.srcObject !== stream) {
    entry.video.srcObject = stream || null;
  }
  entry.name.textContent = label;
  entry.placeholder.querySelector("span").textContent = initials(label);

  const participant = clientIdValue === state.clientId
    ? {
        microphoneEnabled: state.media.microphone,
        cameraEnabled: state.media.camera,
        screenEnabled: state.media.screen,
      }
    : participantByClient(clientIdValue);
  const hasVideo = Boolean(stream && stream.getVideoTracks().some((track) => track.readyState === "live" && track.enabled));
  const mediaLabel = participant?.screenEnabled ? "partage ecran" : hasVideo ? "camera" : "sans video";
  entry.status.textContent = participant?.microphoneEnabled ? mediaLabel : `${mediaLabel} - muet`;
  entry.tile.classList.toggle("is-local", local);
  entry.tile.classList.toggle("is-video-off", !hasVideo);

  return entry;
}

function renderVideos() {
  if (!state.room) {
    state.videoTiles.forEach((entry) => entry.tile.remove());
    state.videoTiles.clear();
    return;
  }

  const activeIds = new Set([state.clientId]);
  const localLabel = state.currentUser?.displayName || "Vous";
  ensureVideoTile(state.clientId, `${localLabel} (vous)`, state.localStream, true);

  state.participants
    .filter((participant) => participant.clientId !== state.clientId)
    .forEach((participant) => {
      activeIds.add(participant.clientId);
      const peer = state.peers.get(participant.clientId);
      ensureVideoTile(participant.clientId, participant.displayName || "Invite", peer?.remoteStream || null, false);
    });

  Array.from(state.videoTiles.entries()).forEach(([clientIdValue, entry]) => {
    if (!activeIds.has(clientIdValue)) {
      entry.tile.remove();
      state.videoTiles.delete(clientIdValue);
    }
  });
}

function renderTranscripts() {
  const items = Array.from(state.transcriptMap.values()).sort((a, b) => a.id - b.id);
  elements.transcriptList.innerHTML = "";

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state inline";
    empty.textContent = "Aucune parole transcrite";
    elements.transcriptList.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const article = document.createElement("article");
    article.className = "transcript-item";

    const head = document.createElement("div");
    const speaker = document.createElement("strong");
    speaker.textContent = item.clientId === state.clientId ? "Vous" : item.speakerName || "Participant";
    const time = document.createElement("span");
    time.textContent = `${formatDate(item.createdAt)} - ${item.sourceLabel || item.sourceLanguage}`;
    head.append(speaker, time);

    const original = document.createElement("p");
    original.textContent = item.text || "";
    article.append(head, original);

    const shouldTranslate = state.translationEnabled && item.targetLanguage !== item.sourceLanguage;
    if (shouldTranslate && item.translatedText) {
      const translated = document.createElement("p");
      translated.className = "translated-text";
      translated.textContent = item.translatedText;
      article.appendChild(translated);
    } else if (shouldTranslate) {
      const note = document.createElement("small");
      note.textContent = item.translationStatus === "unavailable" ? "Traduction indisponible" : "Traduction en attente";
      article.appendChild(note);
    }

    elements.transcriptList.appendChild(article);
  });
  elements.transcriptList.scrollTop = elements.transcriptList.scrollHeight;
}

function updateControlButtons() {
  elements.toggleMicButton.classList.toggle("is-off", !state.media.microphone);
  elements.toggleMicButton.textContent = state.media.microphone ? "Micro" : "Muet";
  elements.toggleCameraButton.classList.toggle("is-off", !state.media.camera);
  elements.toggleCameraButton.textContent = state.media.camera ? "Camera" : "Camera off";
  elements.shareScreenButton.classList.toggle("is-active", state.media.screen);
  elements.shareScreenButton.textContent = state.media.screen ? "Ecran actif" : "Ecran";
}

function mediaAccessMessage(error) {
  if (!window.isSecureContext) {
    return isLoopbackHost()
      ? "Le navigateur bloque camera et micro hors HTTPS. En local, ouvrez MeetOcean avec http://localhost/MeetOcean/ ou utilisez HTTPS."
      : "Camera et micro exigent HTTPS. Configurez la box pour rediriger le port 443 vers le serveur web, puis ouvrez MeetOcean en HTTPS.";
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return "Camera et micro indisponibles dans ce navigateur. Essayez Chrome, Edge ou Firefox.";
  }

  const name = error?.name || "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Autorisation camera/micro refusee ou bloquee. Cliquez sur le cadenas dans la barre d'adresse, autorisez camera et micro, puis rechargez la page.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "Aucun micro ou aucune camera compatible n'a ete detecte.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Le micro ou la camera est deja utilise par une autre application.";
  }
  if (name === "SecurityError") {
    return "Le navigateur bloque l'acces media pour cette page. Verifiez HTTPS et les permissions du site.";
  }

  return error?.message || "Acces micro/camera refuse ou indisponible.";
}

function pruneEndedTracks(stream) {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    if (track.readyState !== "live") {
      stream.removeTrack(track);
    }
  });
}

function hasLiveTrack(stream, kind) {
  if (!stream) return false;
  return stream.getTracks().some((track) => track.kind === kind && track.readyState === "live");
}

function addLocalTracks(stream) {
  if (!state.localStream) {
    state.localStream = new MediaStream();
  }

  stream.getTracks().forEach((track) => {
    state.localStream
      .getTracks()
      .filter((existing) => existing.kind === track.kind && existing.id !== track.id)
      .forEach((existing) => {
        state.localStream.removeTrack(existing);
        existing.stop();
      });

    if (!state.localStream.getTracks().some((existing) => existing.id === track.id)) {
      state.localStream.addTrack(track);
    }
  });
}

function refreshMediaStateFromTracks() {
  pruneEndedTracks(state.localStream);
  state.media.microphone = hasLiveTrack(state.localStream, "audio")
    && state.localStream.getAudioTracks().some((track) => track.enabled);
  state.media.camera = hasLiveTrack(state.localStream, "video")
    && !state.media.screen
    && state.localStream.getVideoTracks().some((track) => track.enabled);
}

async function requestMediaTracks({ audio, video }) {
  const constraints = {
    audio: audio ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false,
    video: video ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
  };
  return navigator.mediaDevices.getUserMedia(constraints);
}

async function ensureLocalMedia(options = {}) {
  const wantsAudio = options.audio !== false;
  const wantsVideo = options.video !== false;

  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    const error = new Error(mediaAccessMessage());
    setMessage(error.message, "error", insecureMediaAction());
    throw error;
  }

  if (!state.localStream) {
    state.localStream = new MediaStream();
  }
  pruneEndedTracks(state.localStream);

  const needsAudio = wantsAudio && !hasLiveTrack(state.localStream, "audio");
  const needsVideo = wantsVideo && !state.media.screen && !hasLiveTrack(state.localStream, "video");
  if (!needsAudio && !needsVideo) {
    refreshMediaStateFromTracks();
    updateControlButtons();
    return state.localStream;
  }

  setMessage("Demande d'autorisation camera/micro...", "info");
  try {
    state.cameraStream = await requestMediaTracks({ audio: needsAudio, video: needsVideo });
    addLocalTracks(state.cameraStream);
  } catch (error) {
    if (needsAudio && needsVideo) {
      try {
        state.cameraStream = await requestMediaTracks({ audio: true, video: false });
        addLocalTracks(state.cameraStream);
        setMessage("Camera indisponible, audio active.", "info");
      } catch (audioError) {
        throw new Error(mediaAccessMessage(audioError));
      }
    } else {
      throw new Error(mediaAccessMessage(error));
    }
  }

  refreshMediaStateFromTracks();
  attachLocalTracksToPeers();
  renderVideos();
  updateControlButtons();
  return state.localStream;
}

function attachLocalTracksToPeers() {
  if (!state.localStream) return;
  state.peers.forEach((peer) => {
    const senders = peer.pc.getSenders();
    state.localStream.getTracks().forEach((track) => {
      const alreadySent = senders.some((sender) => sender.track && sender.track.id === track.id);
      const sameKind = senders.some((sender) => sender.track && sender.track.kind === track.kind);
      if (!alreadySent && !sameKind) {
        peer.pc.addTrack(track, state.localStream);
      }
    });
  });
}

function replaceLocalVideoTrack(track) {
  if (!state.localStream) return;
  state.localStream.getVideoTracks().forEach((existing) => {
    if (!track || existing.id !== track.id) {
      state.localStream.removeTrack(existing);
    }
  });
  if (track && !state.localStream.getVideoTracks().some((existing) => existing.id === track.id)) {
    state.localStream.addTrack(track);
  }
  state.peers.forEach((peer) => {
    const sender = peer.pc.getSenders().find((item) => item.track && item.track.kind === "video");
    if (sender) {
      void sender.replaceTrack(track || null);
    } else if (track) {
      peer.pc.addTrack(track, state.localStream);
    }
  });
  renderVideos();
}

async function toggleMicrophone() {
  const enabled = !state.media.microphone;
  if (enabled) {
    try {
      await ensureLocalMedia({ audio: true, video: false });
    } catch (error) {
      setMessage(error.message || mediaAccessMessage(error), "error", insecureMediaAction());
      return;
    }
  }

  state.localStream?.getAudioTracks().forEach((track) => {
    track.enabled = enabled;
  });
  refreshMediaStateFromTracks();
  updateControlButtons();
  renderVideos();
  if (state.media.microphone) {
    startRecognitionIfNeeded();
  } else {
    stopRecognition();
  }
  void syncNow();
}

async function toggleCamera() {
  const enabled = !state.media.camera;
  if (enabled) {
    try {
      await ensureLocalMedia({ audio: false, video: true });
    } catch (error) {
      setMessage(error.message || mediaAccessMessage(error), "error", insecureMediaAction());
      return;
    }
  }

  state.cameraStream?.getVideoTracks().forEach((track) => {
    track.enabled = enabled;
  });
  if (!state.media.screen) {
    state.localStream?.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }
  refreshMediaStateFromTracks();
  updateControlButtons();
  renderVideos();
  void syncNow();
}

async function shareScreen() {
  try {
    await ensureLocalMedia({ audio: true, video: false });
  } catch (error) {}
  if (state.media.screen) {
    stopScreenShare();
    return;
  }
  if (!navigator.mediaDevices?.getDisplayMedia) {
    setMessage("Partage d ecran indisponible dans ce navigateur.", "error");
    return;
  }

  try {
    state.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const [screenTrack] = state.screenStream.getVideoTracks();
    if (!screenTrack) return;
    screenTrack.onended = () => stopScreenShare();
    state.media.screen = true;
    replaceLocalVideoTrack(screenTrack);
    updateControlButtons();
    void syncNow();
  } catch (error) {
    setMessage("Partage d ecran annule.", "info");
  }
}

function stopScreenShare() {
  state.screenStream?.getTracks().forEach((track) => track.stop());
  state.screenStream = null;
  state.media.screen = false;
  const cameraTrack = state.cameraStream?.getVideoTracks()[0] || null;
  replaceLocalVideoTrack(cameraTrack && state.media.camera ? cameraTrack : null);
  updateControlButtons();
  void syncNow();
}

function shouldInitiate(peerId) {
  return state.clientId.localeCompare(peerId) < 0;
}

function createPeer(participant) {
  const clientIdValue = participant.clientId;
  const existing = state.peers.get(clientIdValue);
  if (existing) return existing;

  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  const remoteStream = new MediaStream();
  const peer = {
    clientId: clientIdValue,
    pc,
    remoteStream,
    offerSent: false,
    makingOffer: false,
    pendingCandidates: [],
  };

  pc.onicecandidate = (event) => {
    if (!event.candidate || !state.room) return;
    void sendSignal(clientIdValue, "candidate", {
      candidate: event.candidate.toJSON(),
    });
  };

  pc.ontrack = (event) => {
    const stream = event.streams[0];
    const tracks = stream ? stream.getTracks() : [event.track];
    tracks.forEach((track) => {
      if (!remoteStream.getTracks().some((existingTrack) => existingTrack.id === track.id)) {
        remoteStream.addTrack(track);
      }
    });
    renderVideos();
  };

  pc.onconnectionstatechange = () => {
    renderVideos();
  };

  state.peers.set(clientIdValue, peer);
  attachLocalTracksToPeers();
  renderVideos();
  return peer;
}

async function makeOffer(peer) {
  if (!state.room || !state.localStream || peer.makingOffer || peer.pc.signalingState !== "stable") return;
  peer.makingOffer = true;
  try {
    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer);
    await sendSignal(peer.clientId, "offer", {
      description: peer.pc.localDescription,
    });
    peer.offerSent = true;
  } catch (error) {
    setMessage("Connexion video impossible avec un participant.", "error");
  } finally {
    peer.makingOffer = false;
  }
}

function syncPeersWithParticipants() {
  if (!state.room || !state.localStream) return;
  const remoteParticipants = state.participants.filter((participant) => participant.clientId !== state.clientId);
  const activeIds = new Set(remoteParticipants.map((participant) => participant.clientId));

  remoteParticipants.forEach((participant) => {
    const peer = createPeer(participant);
    if (shouldInitiate(participant.clientId) && !peer.offerSent) {
      void makeOffer(peer);
    }
  });

  Array.from(state.peers.entries()).forEach(([clientIdValue, peer]) => {
    if (!activeIds.has(clientIdValue)) {
      peer.pc.close();
      state.peers.delete(clientIdValue);
    }
  });
}

async function sendSignal(recipientClientId, signalType, payload = {}) {
  if (!state.room) return null;
  return postAction("signal", {
    roomId: state.room.id,
    senderClientId: state.clientId,
    recipientClientId,
    signalType,
    payload,
  });
}

async function flushPendingCandidates(peer) {
  if (!peer.pc.remoteDescription) return;
  while (peer.pendingCandidates.length > 0) {
    const candidate = peer.pendingCandidates.shift();
    try {
      await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {}
  }
}

async function handleSignal(signal) {
  const senderId = signal.senderClientId;
  if (!senderId || senderId === state.clientId) return;

  if (signal.signalType === "leave") {
    const peer = state.peers.get(senderId);
    if (peer) {
      peer.pc.close();
      state.peers.delete(senderId);
      renderVideos();
    }
    return;
  }

  const participant = participantByClient(senderId) || {
    clientId: senderId,
    displayName: "Participant",
  };
  const peer = createPeer(participant);
  const payload = signal.payload || {};

  try {
    if (signal.signalType === "offer") {
      const description = payload.description || payload.sdp || payload;
      await peer.pc.setRemoteDescription(new RTCSessionDescription(description));
      attachLocalTracksToPeers();
      await flushPendingCandidates(peer);
      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      await sendSignal(senderId, "answer", {
        description: peer.pc.localDescription,
      });
      return;
    }

    if (signal.signalType === "answer") {
      const description = payload.description || payload.sdp || payload;
      if (peer.pc.signalingState !== "stable") {
        await peer.pc.setRemoteDescription(new RTCSessionDescription(description));
        await flushPendingCandidates(peer);
      }
      return;
    }

    if (signal.signalType === "candidate" && payload.candidate) {
      if (peer.pc.remoteDescription) {
        await peer.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } else {
        peer.pendingCandidates.push(payload.candidate);
      }
    }
  } catch (error) {
    setMessage("Signal WebRTC ignore pendant la reconnexion.", "info");
  }
}

async function applySyncPayload(payload) {
  if (payload.room) {
    state.room = payload.room;
    updateRoomHeader();
  }
  if (Array.isArray(payload.participants)) {
    state.participants = payload.participants;
    renderParticipants();
  }
  if (Array.isArray(payload.transcripts)) {
    payload.transcripts.forEach((item) => {
      state.transcriptMap.set(item.id, item);
      state.lastTranscriptId = Math.max(state.lastTranscriptId, Number(item.id || 0));
    });
    renderTranscripts();
  }
  syncPeersWithParticipants();
  renderVideos();

  if (Array.isArray(payload.signals)) {
    for (const signal of payload.signals) {
      state.lastSignalId = Math.max(state.lastSignalId, Number(signal.id || 0));
      await handleSignal(signal);
    }
  }
}

async function syncNow() {
  if (!state.room || state.pendingSync) return;
  state.pendingSync = true;
  try {
    const payload = await postAction("sync", {
      roomId: state.room.id,
      clientId: state.clientId,
      sourceLanguage: state.sourceLanguage,
      targetLanguage: effectiveTargetLanguage(),
      mediaState: mediaState(),
      sinceSignalId: state.lastSignalId,
      sinceTranscriptId: state.lastTranscriptId,
    });
    await applySyncPayload(payload);
  } catch (error) {
    setMessage(error.message || "Synchronisation indisponible.", "error");
  } finally {
    state.pendingSync = false;
  }
}

function startSyncLoop() {
  window.clearInterval(state.syncTimer);
  state.syncTimer = window.setInterval(() => {
    void syncNow();
  }, 1200);
}

function stopSyncLoop() {
  window.clearInterval(state.syncTimer);
  state.syncTimer = null;
}

async function createRoom() {
  if (state.room) return;
  elements.createRoomButton.disabled = true;
  setMessage("Preparation de la reunion...");
  try {
    state.sourceLanguage = elements.sourceLanguage.value || state.sourceLanguage;
    state.targetLanguage = elements.targetLanguage.value || state.targetLanguage;
    syncLanguageControls();
    await ensureLocalMedia();
    const payload = await postAction("create_room", {
      title: elements.roomTitle.value,
      clientId: state.clientId,
      sourceLanguage: state.sourceLanguage,
      targetLanguage: effectiveTargetLanguage(),
      mediaState: mediaState(),
    });
    await enterRoom(payload);
  } catch (error) {
    setMessage(error.message || "Creation impossible.", "error", insecureMediaAction());
  } finally {
    elements.createRoomButton.disabled = false;
  }
}

async function joinRoom() {
  if (state.room) return;
  const code = elements.roomCode.value.trim();
  if (!code) {
    setMessage("Indiquez un code reunion.", "error");
    return;
  }
  elements.joinRoomButton.disabled = true;
  setMessage("Connexion a la reunion...");
  try {
    state.sourceLanguage = elements.sourceLanguage.value || state.sourceLanguage;
    state.targetLanguage = elements.targetLanguage.value || state.targetLanguage;
    syncLanguageControls();
    await ensureLocalMedia();
    const payload = await postAction("join_room", {
      roomCode: code,
      clientId: state.clientId,
      sourceLanguage: state.sourceLanguage,
      targetLanguage: effectiveTargetLanguage(),
      mediaState: mediaState(),
    });
    await enterRoom(payload);
  } catch (error) {
    setMessage(error.message || "Connexion impossible.", "error", insecureMediaAction());
  } finally {
    elements.joinRoomButton.disabled = false;
  }
}

async function enterRoom(payload) {
  state.room = payload.room;
  state.lastSignalId = 0;
  state.lastTranscriptId = 0;
  state.transcriptMap.clear();
  updateRoomHeader();
  setRoomActive(true);
  await applySyncPayload(payload);
  startSyncLoop();
  startRecognitionIfNeeded();
  setMessage(payload.message || "Reunion active.", "success");
  void syncNow();
}

async function leaveRoom() {
  if (!state.room) return;
  const roomId = state.room.id;
  const peers = Array.from(state.peers.keys());
  try {
    await Promise.all(peers.map((peerId) => sendSignal(peerId, "leave", {})));
  } catch (error) {}
  try {
    await postAction("leave_room", {
      roomId,
      clientId: state.clientId,
    });
  } catch (error) {}
  cleanupMeeting();
  setMessage("Reunion quittee.", "success");
  void loadDashboard(false);
}

function cleanupMeeting() {
  stopSyncLoop();
  stopRecognition();
  state.recognitionShouldRun = false;
  state.peers.forEach((peer) => peer.pc.close());
  state.peers.clear();
  state.videoTiles.forEach((entry) => entry.tile.remove());
  state.videoTiles.clear();
  state.localStream?.getTracks().forEach((track) => track.stop());
  state.cameraStream?.getTracks().forEach((track) => track.stop());
  state.screenStream?.getTracks().forEach((track) => track.stop());
  state.localStream = null;
  state.cameraStream = null;
  state.screenStream = null;
  state.room = null;
  state.participants = [];
  state.transcriptMap.clear();
  state.lastSignalId = 0;
  state.lastTranscriptId = 0;
  state.media = {
    microphone: false,
    camera: false,
    screen: false,
    connectionState: "online",
  };
  renderParticipants();
  renderTranscripts();
  renderVideos();
  updateControlButtons();
  setRoomActive(false);
}

function recognitionConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function startRecognitionIfNeeded() {
  state.transcriptionEnabled = elements.transcriptionToggle.checked;
  if (!state.room || !state.transcriptionEnabled || !state.media.microphone) {
    stopRecognition();
    return;
  }

  const Ctor = recognitionConstructor();
  if (!Ctor) {
    if (!state.speechNoticeShown) {
      setMessage("Transcription navigateur indisponible. Essayez Chrome ou Edge.", "error");
      state.speechNoticeShown = true;
    }
    return;
  }

  if (state.recognitionActive) return;
  state.recognitionShouldRun = true;
  const recognition = new Ctor();
  recognition.lang = state.sourceLanguage;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    state.recognitionActive = true;
  };
  recognition.onresult = (event) => {
    let interim = "";
    for (let index = event.resultIndex; index < event.results.length; index++) {
      const result = event.results[index];
      const text = result[0]?.transcript?.trim() || "";
      if (!text) continue;
      if (result.isFinal) {
        void addTranscript(text);
      } else {
        interim += `${text} `;
      }
    }
    showLiveCaption(interim.trim());
  };
  recognition.onerror = (event) => {
    if (!["no-speech", "aborted"].includes(event.error)) {
      setMessage("Transcription momentanement interrompue.", "info");
    }
  };
  recognition.onend = () => {
    state.recognitionActive = false;
    if (state.recognitionShouldRun && state.room && state.transcriptionEnabled && state.media.microphone) {
      window.setTimeout(() => startRecognitionIfNeeded(), 450);
    }
  };

  state.recognition = recognition;
  try {
    recognition.start();
  } catch (error) {}
}

function stopRecognition() {
  state.recognitionShouldRun = false;
  if (!state.recognition) return;
  try {
    state.recognition.stop();
  } catch (error) {}
  state.recognition = null;
  state.recognitionActive = false;
  showLiveCaption("");
}

function restartRecognition() {
  stopRecognition();
  window.setTimeout(() => {
    state.recognitionShouldRun = true;
    startRecognitionIfNeeded();
  }, 300);
}

function showLiveCaption(text) {
  elements.liveCaption.textContent = text;
  elements.liveCaption.classList.toggle("hidden", text === "");
}

function rememberTranscript(text) {
  const fingerprint = `${state.sourceLanguage}:${text.toLowerCase()}`;
  if (state.transcriptFingerprints.includes(fingerprint)) {
    return false;
  }
  state.transcriptFingerprints.push(fingerprint);
  if (state.transcriptFingerprints.length > 40) {
    state.transcriptFingerprints.shift();
  }
  return true;
}

async function addTranscript(text) {
  if (!state.room || !rememberTranscript(text)) return;
  showLiveCaption(text);
  try {
    const payload = await postAction("add_transcript", {
      roomId: state.room.id,
      clientId: state.clientId,
      text,
      sourceLanguage: state.sourceLanguage,
      targetLanguage: effectiveTargetLanguage(),
      mediaState: mediaState(),
      sinceSignalId: state.lastSignalId,
      sinceTranscriptId: state.lastTranscriptId,
    });
    await applySyncPayload(payload);
  } catch (error) {
    setMessage(error.message || "Transcription non enregistree.", "error");
  }
}

function changeActiveLanguage() {
  state.sourceLanguage = elements.activeSourceLanguage.value || state.sourceLanguage;
  state.targetLanguage = elements.activeTargetLanguage.value || state.targetLanguage;
  syncLanguageControls();
  state.lastTranscriptId = 0;
  state.transcriptMap.clear();
  renderTranscripts();
  restartRecognition();
  void syncNow();
}

function changeStartLanguage() {
  state.sourceLanguage = elements.sourceLanguage.value || state.sourceLanguage;
  state.targetLanguage = elements.targetLanguage.value || state.targetLanguage;
  syncLanguageControls();
}

function toggleTranslation() {
  state.translationEnabled = elements.translationToggle.checked;
  elements.activeTargetLanguage.disabled = !state.translationEnabled;
  state.lastTranscriptId = 0;
  state.transcriptMap.clear();
  renderTranscripts();
  void syncNow();
}

async function logout() {
  try {
    await fetch(AUTH_URL, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {}
  window.location.href = OCEANOS_URL;
}

async function copyRoomCode() {
  if (!state.room?.code) return;
  try {
    await navigator.clipboard.writeText(state.room.code);
    setMessage("Code reunion copie.", "success");
  } catch (error) {
    setMessage(state.room.code, "info");
  }
}

function bindEvents() {
  elements.createRoomButton.addEventListener("click", () => void createRoom());
  elements.joinRoomButton.addEventListener("click", () => void joinRoom());
  elements.roomCode.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void joinRoom();
    }
  });
  elements.logoutButton.addEventListener("click", () => void logout());
  elements.copyRoomButton.addEventListener("click", () => void copyRoomCode());
  elements.leaveRoomButton.addEventListener("click", () => void leaveRoom());
  elements.toggleMicButton.addEventListener("click", () => void toggleMicrophone());
  elements.toggleCameraButton.addEventListener("click", () => void toggleCamera());
  elements.shareScreenButton.addEventListener("click", () => void shareScreen());
  elements.transcriptionToggle.addEventListener("change", () => {
    state.transcriptionEnabled = elements.transcriptionToggle.checked;
    if (state.transcriptionEnabled) {
      state.recognitionShouldRun = true;
      startRecognitionIfNeeded();
    } else {
      stopRecognition();
    }
    void syncNow();
  });
  elements.translationToggle.addEventListener("change", toggleTranslation);
  elements.activeSourceLanguage.addEventListener("change", changeActiveLanguage);
  elements.activeTargetLanguage.addEventListener("change", changeActiveLanguage);
  elements.sourceLanguage.addEventListener("change", changeStartLanguage);
  elements.targetLanguage.addEventListener("change", changeStartLanguage);
  elements.clearTranscriptButton.addEventListener("click", () => {
    state.transcriptMap.clear();
    renderTranscripts();
  });
  window.addEventListener("beforeunload", () => {
    if (!state.room) return;
    const body = JSON.stringify({
      action: "leave_room",
      roomId: state.room.id,
      clientId: state.clientId,
    });
    navigator.sendBeacon?.(API_URL, new Blob([body], { type: "application/json" }));
  });
}

async function loadDashboard(showReadyMessage = true) {
  const payload = await requestJson(API_URL);
  renderDashboard(payload);
  setVisible(true);
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    showMediaSecurityMessage();
    return;
  }
  if (showReadyMessage) {
    setMessage(payload.ai?.hasApiKey ? "" : "Ajoutez la cle Groq dans OceanOS pour activer la traduction.", "info");
  }
}

async function boot() {
  bindEvents();
  renderParticipants();
  renderTranscripts();
  updateControlButtons();
  try {
    await loadDashboard();
  } catch (error) {
    setVisible(true);
    setMessage(error.message || "MeetOcean indisponible.", "error");
  }
}

boot();

