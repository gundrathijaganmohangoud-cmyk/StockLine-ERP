const routeGroups = [
  { title: 'Commercial flow', items: [['Enquiries', 'Capture demand and customer context before pricing.'], ['Quotations', 'Turn demand into server-calculated, auditable value.'], ['Sales orders', 'Move accepted commercial intent into fulfillment.']] },
  { title: 'Operational control', items: [['Confirm & reserve', 'Admin-only action that protects inventory from overcommitment.'], ['Dispatch', 'Record the physical handoff and deduct stock accurately.']] },
];

export default function About() {
  return <div className="about-page">
    <section className="about-hero"><p className="eyebrow">StockFlow ERP · operating model</p><h1>A shared language for the order lifecycle.</h1><p>StockFlow connects the people who create demand with the people who make delivery possible. Every screen exists to move one business truth forward.</p></section>
    <div className="about-grid"><section className="surface-panel"><p className="eyebrow">The principle</p><h2>Make the next action obvious.</h2><p className="large-copy">Sales needs speed and confidence. Operations needs control and reliable stock numbers. StockFlow keeps both teams in the same flow without giving every role the same power.</p><div className="principle-list"><div><b>01</b><span><strong>Commercial clarity</strong><small>Pricing is recalculated on the server, not trusted from the browser.</small></span></div><div><b>02</b><span><strong>Operational truth</strong><small>Reservations and dispatches update inventory inside transactions.</small></span></div><div><b>03</b><span><strong>Role clarity</strong><small>Sales advances opportunity; Admin protects fulfillment.</small></span></div></div></section><section className="route-guide"><p className="eyebrow">Navigation guide</p>{routeGroups.map((group) => <div className="guide-group" key={group.title}><h3>{group.title}</h3>{group.items.map(([name, description]) => <div className="guide-row" key={name}><strong>{name}</strong><span>{description}</span></div>)}</div>)}</section></div>
  </div>;
}
