import { useCallback, useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';

export default function SalesOrders() {
  const { user } = useAuth();
  const isAdmin = user && user.role === 'ADMIN';

  const [orders, setOrders] = useState([]);
  const [acceptedQuotations, setAcceptedQuotations] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [orderDetail, setOrderDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [dispatchForm, setDispatchForm] = useState({ vehicleNumber: '', driverName: '' });
  const [dispatching, setDispatching] = useState(false);

  const load = useCallback(async () => {
    try {
      const [o, q] = await Promise.all([axiosClient.get('/sales-orders'), axiosClient.get('/quotations')]);
      setOrders(o.data);
      setAcceptedQuotations(q.data.filter((x) => x.status === 'ACCEPTED'));
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load sales orders');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  async function toggleDetail(orderId) {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      setOrderDetail(null);
      return;
    }
    setExpandedOrderId(orderId);
    setOrderDetail(null);
    setDetailLoading(true);
    try {
      const { data } = await axiosClient.get('/sales-orders/' + orderId);
      setOrderDetail(data);
    } catch (err) {
      setError(err.message || 'Failed to load order detail');
      setExpandedOrderId(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function confirmOrder(orderId) {
    setError('');
    setSuccess('');
    setConfirming(true);
    try {
      await axiosClient.post('/sales-orders/' + orderId + '/confirm');
      setSuccess('Order confirmed - stock reserved.');
      await Promise.all([load(), toggleDetail(orderId)]);
    } catch (err) {
      setError(err.message || 'Confirmation failed');
    } finally {
      setConfirming(false);
    }
  }

  async function dispatchOrder(orderId, detail) {
    setError('');
    setSuccess('');
    if (!dispatchForm.vehicleNumber.trim() || !dispatchForm.driverName.trim()) {
      setError('Vehicle number and driver name are required.');
      return;
    }
    setDispatching(true);
    try {
      await axiosClient.post('/sales-orders/' + orderId + '/dispatch', {
        vehicleNumber: dispatchForm.vehicleNumber,
        driverName: dispatchForm.driverName,
        items: detail.items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
      });
      setSuccess('Dispatch created.');
      setDispatchForm({ vehicleNumber: '', driverName: '' });
      setExpandedOrderId(null);
      setOrderDetail(null);
      await load();
    } catch (err) {
      setError(err.message || 'Dispatch failed');
    } finally {
      setDispatching(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Sales Orders</h1>
      </div>

      {error && <div className="banner error">{error}</div>}
      {success && <div className="banner success">{success}</div>}

      {acceptedQuotations.length > 0 && (
        <section className="card">
          <h2>Quotations ready to convert (ACCEPTED)</h2>
          <ul className="convert-list">
            {acceptedQuotations.map((q) => (
              <li key={q.id}>
                <span>
                  {q.quotationNumber} - {q.customerName} - total {Number(q.grandTotal).toFixed(2)}
                </span>
                <button type="button" className="btn btn-small btn-primary" onClick={() => convert(q.id)}>
                  Convert to Order
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Number</th>
            <th>Quotation</th>
            <th>Customer</th>
            <th>Status</th>
            <th>Total</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 && (
            <tr>
              <td colSpan="6" className="muted">
                No sales orders yet. Convert an ACCEPTED quotation above.
              </td>
            </tr>
          )}
          {orders.map((o) => (
            <tr key={o.id} className={expandedOrderId === o.id ? 'expanded' : ''}>
              <td>{o.orderNumber}</td>
              <td>{o.quotation ? o.quotation.quotationNumber : '-'}</td>
              <td>{o.customerName}</td>
              <td>
                <StatusBadge status={o.status} />
              </td>
              <td>{Number(o.totalAmount).toFixed(2)}</td>
              <td className="actions">
                <button type="button" className="btn btn-small" onClick={() => toggleDetail(o.id)}>
                  {expandedOrderId === o.id ? 'Hide' : 'Details'}
                </button>
                {o.status === 'PENDING' && (
                  <button
                    type="button"
                    className="btn btn-small btn-primary"
                    disabled={!isAdmin || confirming}
                    title={isAdmin ? 'Reserve stock now' : 'Admin role required'}
                    onClick={() => confirmOrder(o.id)}
                  >
                    Confirm &amp; Reserve
                  </button>
                )}
                {o.status === 'DISPATCHED' && <span className="muted small">dispatched</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {expandedOrderId && (
        <section className="card">
          <h2>Order detail {orderDetail ? orderDetail.orderNumber : ''}</h2>
          {detailLoading && <p className="muted">Loading...</p>}
          {orderDetail && (
            <>
              <table className="line-items">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Unit price</th>
                    <th>Available (physical - reserved - damaged)</th>
                  </tr>
                </thead>
                <tbody>
                  {orderDetail.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.product.productCode} - {item.product.productName}
                      </td>
                      <td>{item.quantity}</td>
                      <td>{Number(item.unitPrice).toFixed(2)}</td>
                      <td>{item.availableQty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {orderDetail.status === 'PENDING' && (
                <div className="detail-note">
                  <p className="muted small">
                    Confirming reserves the ordered quantities. ADMIN only.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!isAdmin || confirming}
                    title={isAdmin ? 'Reserve stock now' : 'Admin role required'}
                    onClick={() => confirmOrder(orderDetail.id)}
                  >
                    {confirming ? 'Confirming...' : 'Confirm & Reserve'}
                  </button>
                </div>
              )}

              {orderDetail.status === 'CONFIRMED' && (
                <div className="detail-note">
                  <h3>Dispatch</h3>
                  {!isAdmin && <p className="muted small">Only ADMIN can dispatch.</p>}
                  <div className="form-grid">
                    <label>
                      Vehicle number
                      <input
                        value={dispatchForm.vehicleNumber}
                        onChange={(e) => setDispatchForm((f) => ({ ...f, vehicleNumber: e.target.value }))}
                        disabled={!isAdmin || dispatching}
                      />
                    </label>
                    <label>
                      Driver name
                      <input
                        value={dispatchForm.driverName}
                        onChange={(e) => setDispatchForm((f) => ({ ...f, driverName: e.target.value }))}
                        disabled={!isAdmin || dispatching}
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!isAdmin || dispatching}
                    onClick={() => dispatchOrder(orderDetail.id, orderDetail)}
                  >
                    {dispatching ? 'Dispatching...' : 'Create Dispatch'}
                  </button>
                </div>
              )}

              {orderDetail.status === 'DISPATCHED' && (
                <p className="muted">This order has been dispatched. See the Dispatches module for records.</p>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}


