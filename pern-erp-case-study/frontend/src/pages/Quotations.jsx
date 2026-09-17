import { useCallback, useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import StatusBadge from '../components/StatusBadge';

const ROUND2 = (n) => Math.round(Number(n || 0) * 100) / 100;

// Client-side ESTIMATE using the same formula as the backend. The backend
// always recomputes the authoritative total.
function estimateLine(line) {
  const qty = Number(line.quantity) || 0;
  const price = Number(line.unitPrice) || 0;
  const base = qty * price;
  const afterDiscount = base * (1 - (Number(line.discountPct) || 0) / 100);
  return ROUND2(afterDiscount * (1 + (Number(line.gstPct) || 0) / 100));
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function Quotations() {
  const [quotations, setQuotations] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({ enquiryId: '', validUntil: '' });
  const [items, setItems] = useState([{ productId: '', quantity: 1, unitPrice: '', discountPct: 0, gstPct: 18 }]);

  const load = useCallback(async () => {
    try {
      const [q, e, p] = await Promise.all([
        axiosClient.get('/quotations'),
        axiosClient.get('/enquiries'),
        axiosClient.get('/products'),
      ]);
      setQuotations(q.data);
      setEnquiries(e.data);
      setProducts(p.data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load quotations');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function quotableEnquiries() {
    return enquiries.filter((e) => e.status === 'NEW' || e.status === 'QUOTED');
  }

  function setItem(index, field, value) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function onProductChange(index, productId) {
    const product = products.find((p) => p.id === Number(productId));
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, productId: productId, unitPrice: product ? String(product.basePrice) : item.unitPrice }
          : item
      )
    );
  }

  function addItem() {
    setItems((prev) => [...prev, { productId: '', quantity: 1, unitPrice: '', discountPct: 0, gstPct: 18 }]);
  }

  function removeItem(index) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  const estimatedTotal = ROUND2(items.reduce((sum, line) => sum + estimateLine(line), 0));

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!form.enquiryId) {
      setError('Select an enquiry to quote against.');
      return;
    }
    const lines = items.filter((line) => line.productId);
    if (lines.length === 0) {
      setError('Add at least one product line.');
      return;
    }

    setSubmitting(true);
    try {
      await axiosClient.post('/quotations', {
        enquiryId: Number(form.enquiryId),
        validUntil: form.validUntil || undefined,
        items: lines.map((line) => ({
          productId: Number(line.productId),
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          discountPct: Number(line.discountPct) || 0,
          gstPct: Number(line.gstPct) || 0,
        })),
      });
      setSuccess('Quotation created as DRAFT. Send it to the customer, then Accept or Reject.');
      setForm({ enquiryId: '', validUntil: '' });
      setItems([{ productId: '', quantity: 1, unitPrice: '', discountPct: 0, gstPct: 18 }]);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message || 'Failed to create quotation');
    } finally {
      setSubmitting(false);
    }
  }

  async function changeStatus(quotationId, status) {
    setError('');
    setSuccess('');
    try {
      await axiosClient.patch('/quotations/' + quotationId + '/status', { status: status });
      setSuccess('Quotation ' + (status === 'ACCEPTED' ? 'accepted' : status === 'REJECTED' ? 'rejected' : 'sent') + '.');
      await load();
    } catch (err) {
      setError(err.message || 'Status update failed');
    }
  }

  async function convert(quotationId) {
    setError('');
    setSuccess('');
    try {
      const { data } = await axiosClient.post('/quotations/' + quotationId + '/convert');
      setSuccess('Converted to sales order ' + data.orderNumber + '.');
      await load();
    } catch (err) {
      setError(err.message || 'Conversion failed');
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Quotations</h1>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close form' : 'New Quotation'}
        </button>
      </div>

      {error && <div className="banner error">{error}</div>}
      {success && <div className="banner success">{success}</div>}

      {showForm && (
        <form className="card" onSubmit={handleSubmit}>
          <h2>New Quotation</h2>
          <div className="form-grid">
            <label>
              Enquiry
              <select value={form.enquiryId} onChange={(e) => setForm((f) => ({ ...f, enquiryId: e.target.value }))}>
                <option value="">Select an enquiry...</option>
                {quotableEnquiries().map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.enquiryNumber} - {e.customerName} ({e.status})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Valid until
              <input
                type="date"
                min={todayISO()}
                value={form.validUntil}
                onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
              />
            </label>
          </div>

          <h3>Line items</h3>
          <table className="line-items">
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Unit price</th>
                <th>Discount pct</th>
                <th>GST pct</th>
                <th>Estimated line total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td>
                    <select value={item.productId} onChange={(e) => onProductChange(index, e.target.value)}>
                      <option value="">Select...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.productCode} - {p.productName}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => setItem(index, 'quantity', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => setItem(index, 'unitPrice', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={item.discountPct}
                      onChange={(e) => setItem(index, 'discountPct', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.gstPct}
                      onChange={(e) => setItem(index, 'gstPct', e.target.value)}
                    />
                  </td>
                  <td>{estimateLine(item).toFixed(2)}</td>
                  <td>
                    <button type="button" className="btn btn-small" onClick={() => removeItem(index)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="btn btn-small" onClick={addItem}>
            + Add line
          </button>

          <div className="total-row">
            <strong>Estimated total: {estimatedTotal.toFixed(2)}</strong>
            <span className="muted small">(estimated - backend confirms final total)</span>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Create Quotation'}
            </button>
          </div>
        </form>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Number</th>
            <th>Enquiry</th>
            <th>Customer</th>
            <th>Status</th>
            <th>Grand total</th>
            <th>Valid until</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {quotations.length === 0 && (
            <tr>
              <td colSpan="7" className="muted">
                No quotations yet.
              </td>
            </tr>
          )}
          {quotations.map((q) => (
            <tr key={q.id}>
              <td>{q.quotationNumber}</td>
              <td>{q.enquiry ? q.enquiry.enquiryNumber : '-'}</td>
              <td>{q.customerName}</td>
              <td>
                <StatusBadge status={q.status} />
              </td>
              <td>{Number(q.grandTotal).toFixed(2)}</td>
              <td>{q.validUntil ? String(q.validUntil).slice(0, 10) : '-'}</td>
              <td className="actions">
                {q.status === 'DRAFT' && (
                  <button type="button" className="btn btn-small" onClick={() => changeStatus(q.id, 'SENT')}>
                    Send
                  </button>
                )}
                {q.status === 'SENT' && (
                  <>
                    <button
                      type="button"
                      className="btn btn-small btn-accept"
                      onClick={() => changeStatus(q.id, 'ACCEPTED')}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="btn btn-small btn-reject"
                      onClick={() => changeStatus(q.id, 'REJECTED')}
                    >
                      Reject
                    </button>
                  </>
                )}
                {q.status === 'ACCEPTED' && (
                  <button type="button" className="btn btn-small btn-primary" onClick={() => convert(q.id)}>
                    Convert to Order
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


