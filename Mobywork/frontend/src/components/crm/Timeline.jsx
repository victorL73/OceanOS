import { Mail, ShoppingCart, Send, MousePointerClick, Tag, Package, Star, Clock } from 'lucide-react';

export default function Timeline({ events }) {
  if (!events || events.length === 0) {
    return <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Aucun événement enregistré.</p>;
  }

  const getIcon = (type) => {
    switch(type) {
        case 'email': return <Mail size={14} />;
        case 'cart': return <ShoppingCart size={14} />;
        case 'promo': return <Tag size={14} />;
        case 'order': return <Package size={14} />;
        case 'vip': return <Star size={14} />;
        case 'relance': return <Clock size={14} />;
        default: return <Send size={14} />;
    }
  };

  const getIconColorClass = (type) => {
    switch(type) {
        case 'email': return 'bg-blue';
        case 'cart': return 'bg-orange';
        case 'promo': return 'bg-purple';
        case 'order': return 'bg-green';
        case 'vip': return 'bg-yellow';
        case 'relance': return 'bg-red';
        default: return 'bg-indigo';
    }
  }

  const formatDate = (dateString) => {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  };

  return (
    <div className="crm-timeline">
      {events.map((event, index) => (
        <div key={event.id || index} className="crm-timeline-item">
          <div className="crm-timeline-tail"></div>
          <div className={`crm-timeline-icon ${getIconColorClass(event.type)}`}>
             {getIcon(event.type)}
          </div>
          <div className="crm-timeline-content animate-slide-up" style={{ animationDelay: `${index * 0.05}s` }}>
             <div className="crm-timeline-date">{formatDate(event.date)}</div>
             <div className="crm-timeline-text">{event.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
