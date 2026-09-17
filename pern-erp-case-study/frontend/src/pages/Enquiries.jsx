import { useCallback, useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import StatusBadge from '../components/StatusBadge';

const STATUSES = ['NEW', 'QUOTED', 'WON', 'LOST'];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function Enquiries() {
  const [enquiries, setEnquiries] = useState([]);
  const [products, setProducts] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    existingCustomerId: '',
    companyName: '',
    contactPerson: '',
    mobile: '',
    email: '',
    city: '',
    enquiryDate: todayISO(),
    requiredDate: '',
    notes: '',
  });
  const [items, setItems] = useState([{ productId: '', quantity: 1 }]);

  const loadEnquiries = useCallback(async () => {
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const { data } = await axiosClient.get('/enquiries', { params });
      setEnquiries(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load enquiries');
    }
  }, [statusFilter]);

  useEffect(() => {
    loadEnquiries();
  }, [loadEnquiries]);

  useEffect(() => {
    axiosClient
      .get('/products')
      .then((res) => setProducts(res.data))
      .catch((err) => setError(err.message || 'Failed to load products'));
  }, []);

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function setItem(index, field, value) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, { productId: '', quantity: 1 }]);
  }

  function removeItem(index) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const lines = items
      .map((item) => ({ productId: Number(item.productId), quantity: Number(item.quantity) }))
      .filter((line) => line.productId);
    if (lines.length === 0) {
      setError('Add at least one product line.');
      return;
    }
    if (lines.some((line) => !Number.isInteger(line.quantity) || line.quantity <= 0)) {
      setError('Every line needs a quantity greater than 0.');
      return;
    }

    const payload = { enquiryDate: form.enquiryDate, items: lines };
    if (form.requiredDate) payload.requiredDate = form.requiredDate;
    if (form.notes) payload.notes = form.notes;
    if (form.existingCustomerId) {
      payload.customerId = Number(form.existingCustomerId);
    } else {
      payload.customer = {
        companyName: form.companyName,
        contactPerson: form.contactPerson,
        mobile: form.mobile,
        email: form.email || undefined,
        city: form.city || undefined,
      };
    }

    setSubmitting(true);
    try {
      await axiosClient.post('/enquiries', payload);
      setSuccess('Enquiry created.');
      setForm((prev) => ({
        ...prev,
        existingCustomerId: '',
        companyName: '',
        contactPerson: '',
        mobile: '',
        email: '',
        city: '',
        notes: '',
      }));
      setItems([{ productId: '', quantity: 1 }]);
      setShowForm(false);
      await loadEnquiries();
    } catch (err) {
      setError(err.message || 'Failed to create enquiry');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Enquiries</h1>
        <div className="page-actions">
          <label className="inline-label">
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Close form' : 'New Enquiry'}
          </button>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}
      {success && <div className="banner success">{success}</div>}

      {showForm && (
        <form className="card" onSubmit={handleSubmit}>
          <h2>New Enquiry</h2>
          <div className="form-grid">
            <label>
              Existing customer ID (optional)
              <input
                type="number"
                min="1"
                value={form.existingCustomerId}
                onChange={(e) => setField('existingCustomerId', e.target.value)}
                placeholder="Leave empty to create a new customer"
              />
            </label>
            <label>
              Company name
              <input value={form.companyName} onChange={(e) => setField('companyName', e.target.value)} />
            </label>
            <label>
              Contact person
              <input value={form.contactPerson} onChange={(e) => setField('contactPerson', e.target.value)} />
            </label>
            <label>
              Mobile
              <input value={form.mobile} onChange={(e) => setField('mobile', e.target.value)} />
            </label>
            <label>
              Email
              <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} />
            </label>
            <label>
              City
              <input value={form.city} onChange={(e) => setField('city', e.target.value)} />
            </label>
            <label>
              Enquiry date
              <input type="date" value={form.enquiryDate} onChange={(e) => setField('enquiryDate', e.target.value)} required />
            </label>
            <label>
              Required date
              <input type="date" value={form.requiredDate} onChange={(e) => setField('requiredDate', e.target.value)} />
            </label>
            <label className="span-2">
              Notes
              <input value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
            </label>
          </div>

          <h3>Line items</h3>
          <table className="line-items">
            <thead>
              <tr>
                <th>Product</th>
                <th>Quantity</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td>
                    <select value={item.productId} onChange={(e) => setItem(index, 'productId', e.target.value)}>
                      <option value="">Select a product...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.productCode} - {p.productName} ({p.unit})
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

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Create Enquiry'}
            </button>
          </div>
        </form>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Number</th>
            <th>Customer</th>
            <th>Status</th>
            <th>Items</th>
            <th>Enquiry date</th>
            <th>Required date</th>
          </tr>
        </thead>
        <tbody>
          {enquiries.length === 0 && (
            <tr>
              <td colSpan="6" className="muted">
                No enquiries yet.
              </td>
            </tr>
          )}
          {enquiries.map((e) => (
            <tr key={e.id}>
              <td>{e.enquiryNumber}</td>
              <td>{e.customerName}</td>
              <td>
                <StatusBadge status={e.status} />
              </td>
              <td>{e.itemCount}</td>
              <td>{e.enquiryDate ? String(e.enquiryDate).slice(0, 10) : ''}</td>
              <td>{e.requiredDate ? String(e.requiredDate).slice(0, 10) : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


