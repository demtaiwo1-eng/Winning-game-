// apps/web/src/App.tsx
import React, { useState, useEffect, useRef } from 'react';
import PublicLanding from './components/PublicLanding';
import SplashLogo from './components/SplashLogo';
import AudioExperience from './components/AudioExperience';

import { initializeEphintaTheme } from "./lib/ephintaTheme";
import { formatMoneyInput, formatMinorCurrency, majorToMinorUnits } from './lib/currency';
type AuthPayload = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    locale?: string;
    country?: string;
    currency?: string;
  };
};

type EventSummary = {
  id: string;
  title: string;
  status?: string;
  type?: string;
  startsAt?: string | null;
  expectedGuests?: number | null;
  city?: string | null;
  country?: string | null;
  currency?: string;
};

type EventDetail = {
  event: EventSummary & { description?: string | null; city?: string | null; country?: string | null; currency?: string };
  summary: {
    guests: { byRsvp: Record<string, number>; expectedHeadcount: number };
    tasks: Record<string, number>;
    budget: { currency: string; plannedMinor: string; actualMinor: string };
  };
};

type Task = { id: string; title: string; status: string };
type Guest = { id: string; name: string; rsvp: string; plusOnes: number };
type Listing = { id: string; title: string; description?: string | null; priceMinor: string; currency: string; city?: string | null; type: string; vendor?: { businessName: string }; category?: { name: string } };
type VendorProfile = { id: string; businessName: string; description?: string | null; country?: string | null; city?: string | null; lat?: number | null; lng?: number | null };
type Category = { id: string; name: string };
type KycRequest = { id: string; kind: string; status: string; documentUrl?: string | null; notes?: string | null };
type DetailPanel = 'overview' | 'tasks' | 'guests' | 'budget' | 'vendors';


initializeEphintaTheme();

function VendorPortal({ payload, onLogout }: { payload: AuthPayload; onLogout: () => void }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('NG');
  const [productTitle, setProductTitle] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productType, setProductType] = useState('SERVICE');
  const [productStatus, setProductStatus] = useState('DRAFT');
  const [vendorFeedback, setVendorFeedback] = useState('');
  const [kycRequests, setKycRequests] = useState<KycRequest[]>([]);
  const [kycKind, setKycKind] = useState('BUSINESS');
  const [kycUrl, setKycUrl] = useState('');
  const [kycNotes, setKycNotes] = useState('');

  useEffect(() => {
    const headers = { Authorization: `Bearer ${payload.accessToken}` };
    Promise.all([fetch('/api/v1/listings', { headers }), fetch('/api/v1/vendor/profile', { headers }), fetch('/api/v1/vendor/categories', { headers })])
      .then(async ([listingResponse, profileResponse, categoryResponse]) => {
        if (!listingResponse.ok || !profileResponse.ok || !categoryResponse.ok) throw new Error('Unable to load your vendor workspace.');
        return Promise.all([listingResponse.json(), profileResponse.json(), categoryResponse.json()]);
      })
      .then(([listingResult, profileResult, categoryResult]) => {
        setListings(listingResult.items ?? []);
        const nextProfile = profileResult.profile as VendorProfile;
        setProfile(nextProfile);
        setBusinessName(nextProfile.businessName);
        setDescription(nextProfile.description ?? '');
        setCity(nextProfile.city ?? '');
        setCountry(nextProfile.country ?? 'NG');
        setCategories(categoryResult.items ?? []);
        setProductCategory(categoryResult.items?.[0]?.id ?? '');
      })
      .catch((error: Error) => setVendorFeedback(error.message))
      .finally(() => setIsLoading(false));
  }, [payload.accessToken]);

  useEffect(() => {
    fetch('/api/v1/vendor/kyc', { headers: { Authorization: `Bearer ${payload.accessToken}` } })
      .then((response) => response.json())
      .then((result) => setKycRequests(result.items ?? []))
      .catch(() => setKycRequests([]));
  }, [payload.accessToken]);

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const response = await fetch('/api/v1/vendor/profile', { method: 'PATCH', headers: { ...{ Authorization: `Bearer ${payload.accessToken}` }, 'Content-Type': 'application/json' }, body: JSON.stringify({ businessName, description, city, country }) });
    const result = await response.json().catch(() => ({}));
    setVendorFeedback(response.ok ? 'Profile saved.' : result?.error?.message || 'Unable to save profile.');
    if (response.ok) setProfile(result.profile);
  };

  const createProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const response = await fetch('/api/v1/vendor/listings', { method: 'POST', headers: { ...{ Authorization: `Bearer ${payload.accessToken}` }, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: productTitle, description: productDescription, priceMinor: majorToMinorUnits(productPrice), categoryId: productCategory, type: productType, status: productStatus, currency: payload.user.currency || 'NGN', city, country }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setVendorFeedback(result?.error?.message || 'Unable to create product.'); return; }
    setListings((current) => [result.listing, ...current]);
    setProductTitle(''); setProductDescription(''); setProductPrice('');
    setVendorFeedback('Product saved to your storefront.');
  };

  const removeProduct = async (listing: Listing) => {
    if (!window.confirm(`Delete ${listing.title}?`)) return;
    const response = await fetch(`/api/v1/vendor/listings/${listing.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${payload.accessToken}` } });
    if (response.ok) { setListings((current) => current.filter((item) => item.id !== listing.id)); setVendorFeedback('Product removed.'); }
  };

  const submitKyc = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const response = await fetch('/api/v1/vendor/kyc', { method: 'POST', headers: { Authorization: `Bearer ${payload.accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: kycKind, documentUrl: kycUrl, notes: kycNotes }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setVendorFeedback(result?.error?.message || 'Unable to submit verification.'); return; }
    setKycRequests((current) => [result.request, ...current]); setKycUrl(''); setKycNotes(''); setVendorFeedback('Verification request submitted.');
  };

  return (
    <main className="workspace-shell vendor-portal">
      <header className="workspace-header">
        <div><p className="eyebrow">Vendor workspace</p><h1>Welcome, {payload.user.name}</h1><p className="workspace-subtitle">Manage your storefront and respond to event opportunities.</p></div>
        <button className="secondary-button" onClick={onLogout}>Sign out</button>
      </header>
      {vendorFeedback && <p className="detail-feedback">{vendorFeedback}</p>}
      <section className="vendor-dashboard-grid">
        <div className="workspace-card vendor-hero-card"><p className="eyebrow">Your business</p><h2>Turn your services into booked experiences.</h2><p>Keep your products current, publish clear prices, and become discoverable to planners whose events match your location and needs.</p><button className="primary-button" onClick={() => document.getElementById('vendor-products')?.scrollIntoView({ behavior: 'smooth' })}>Manage products</button></div>
        <div className="workspace-card"><p className="eyebrow">Marketplace status</p><h2>{listings.length}</h2><p>Active products visible to event planners.</p><div className="vendor-metric-row"><span>Profile status</span><strong>Ready for review</strong></div><div className="vendor-metric-row"><span>Portal role</span><strong>Vendor</strong></div></div>
      </section>
      <section className="workspace-card vendor-profile-card"><div className="section-header"><div><p className="eyebrow">Business profile</p><h2>Tell planners who you are</h2></div></div><form className="vendor-form" onSubmit={saveProfile}><input value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Business name" required /><input value={city} onChange={(event) => setCity(event.target.value)} placeholder="City" /><input value={country} onChange={(event) => setCountry(event.target.value)} placeholder="Country" maxLength={2} /><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Business description" rows={3} /><button className="primary-button" type="submit">Save profile</button></form></section>
      <section className="workspace-card vendor-profile-card"><div className="section-header"><div><p className="eyebrow">Trust & verification</p><h2>KYC status</h2></div><strong>{kycRequests[0]?.status || 'NOT STARTED'}</strong></div><form className="vendor-form kyc-form" onSubmit={submitKyc}><div className="vendor-form-grid"><select value={kycKind} onChange={(event) => setKycKind(event.target.value)}><option value="BUSINESS">Business verification</option><option value="IDENTITY">Identity verification</option></select><input type="url" value={kycUrl} onChange={(event) => setKycUrl(event.target.value)} placeholder="Document URL" required /></div><textarea value={kycNotes} onChange={(event) => setKycNotes(event.target.value)} placeholder="Notes for the verification team" rows={2} /><button className="primary-button" type="submit">Submit verification</button></form>{kycRequests.length > 0 && <ul className="detail-list">{kycRequests.slice(0, 3).map((request) => <li key={request.id}><span>{request.kind} verification</span><small>{request.status}</small></li>)}</ul>}</section>
      <section className="workspace-card vendor-products-card" id="vendor-products"><div className="section-header"><div><p className="eyebrow">Storefront</p><h2>Publish a product or service</h2></div></div><form className="vendor-form product-form" onSubmit={createProduct}><input value={productTitle} onChange={(event) => setProductTitle(event.target.value)} placeholder="Product or service name" required /><textarea value={productDescription} onChange={(event) => setProductDescription(event.target.value)} placeholder="Describe what planners receive" rows={3} /><div className="vendor-form-grid"><select value={productCategory} onChange={(event) => setProductCategory(event.target.value)} required><option value="">Choose category</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select><select value={productType} onChange={(event) => setProductType(event.target.value)}><option value="SERVICE">Service</option><option value="GOOD">Product</option><option value="VENUE">Venue</option></select><input value={productPrice} onChange={(event) => setProductPrice(formatMoneyInput(event.target.value))} onBlur={() => setProductPrice((current) => formatMoneyInput(current, true))} placeholder="5,000,000.00" inputMode="decimal" aria-label="Price in major currency units" required /><select value={productStatus} onChange={(event) => setProductStatus(event.target.value)}><option value="DRAFT">Save as draft</option><option value="ACTIVE">Publish now</option></select></div><button className="primary-button" type="submit">Save product</button></form><div className="listing-grid">{isLoading ? <p>Loading your products...</p> : listings.length === 0 ? <div className="empty-marketplace"><strong>Your storefront is waiting for its first product.</strong><span>Create a product above with a category, price, location, and description.</span></div> : listings.map((listing) => <article className="listing-card" key={listing.id}><p className="eyebrow">{listing.category?.name || listing.type}</p><h3>{listing.title}</h3><p>{listing.description || 'No product description yet.'}</p><footer><span>{listing.city || 'Location not set'}</span><strong>{formatMinorCurrency(listing.priceMinor, listing.currency)}</strong></footer><button className="remove-button" onClick={() => removeProduct(listing)}>Delete product</button></article>)}</div></section>
    </main>
  );
}

const NEEDS_BY_TYPE: Record<string, string[]> = {
  Wedding: ['Venue', 'Catering', 'Photography', 'Decor', 'Music'],
  Birthday: ['Venue', 'Catering', 'Cake', 'Entertainment'],
  'Naming ceremony': ['Venue', 'Catering', 'Decor', 'Photography'],
  'Corporate event': ['Venue', 'AV and staging', 'Catering', 'Security'],
  Graduation: ['Venue', 'Catering', 'Photography', 'Music'],
  Remembrance: ['Venue', 'Catering', 'Transport', 'Security'],
};
const TYPE_MAP: Record<string, string> = { Wedding: 'PERSONAL', Birthday: 'PERSONAL', 'Naming ceremony': 'CULTURAL', 'Corporate event': 'CORPORATE', Graduation: 'EDUCATIONAL', Remembrance: 'PERSONAL' };

function Workspace({ payload, onLogout }: { payload: AuthPayload; onLogout: () => void }) {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState('PERSONAL');
  const [eventDate, setEventDate] = useState('');
  const [eventCity, setEventCity] = useState('');
  const [eventCountry, setEventCountry] = useState('NG');
  const [expectedGuests, setExpectedGuests] = useState('');
  const [eventCurrency, setEventCurrency] = useState('NGN');
  const [feedback, setFeedback] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(null);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [budgetLabel, setBudgetLabel] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [detailPanel, setDetailPanel] = useState<DetailPanel>('overview');
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedListings, setSelectedListings] = useState<string[]>([]);
  const [vendorSearch, setVendorSearch] = useState('');
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const draftRef = useRef<{ type?: string } | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ess:eventDraft');
      if (!saved) return;
      const d = JSON.parse(saved);
      draftRef.current = d;
      const name = `${d.vibe ?? ''} ${String(d.type ?? 'event').toLowerCase()}`.trim();
      setTitle(name.charAt(0).toUpperCase() + name.slice(1));
      setEventType(TYPE_MAP[d.type] ?? 'PERSONAL');
      if (d.date) setEventDate(d.date);
      if (d.guests) setExpectedGuests(String(d.guests));
      setFeedback('We filled in the design you saved. Review it, then create your event.');
    } catch { /* saved design unreadable, ignore */ }
  }, []);

  useEffect(() => {
    fetch('/api/v1/events', { headers: { Authorization: `Bearer ${payload.accessToken}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load your events.');
        return response.json();
      })
      .then((result) => setEvents(Array.isArray(result) ? result : result.items ?? []))
      .catch((error: Error) => setFeedback(error.message))
      .finally(() => setIsLoading(false));
  }, [payload.accessToken]);

  useEffect(() => {
    if (!selectedEvent) return;
    setFeedback('');
    Promise.all([
      fetch(`/api/v1/events/${selectedEvent.id}`, { headers: { Authorization: `Bearer ${payload.accessToken}` } }),
      fetch(`/api/v1/events/${selectedEvent.id}/tasks`, { headers: { Authorization: `Bearer ${payload.accessToken}` } }),
      fetch(`/api/v1/events/${selectedEvent.id}/guests`, { headers: { Authorization: `Bearer ${payload.accessToken}` } }),
    ])
      .then(async ([eventResponse, tasksResponse, guestsResponse]) => {
        if (!eventResponse.ok || !tasksResponse.ok || !guestsResponse.ok) throw new Error('Unable to load event details.');
        const [eventResult, taskResult, guestResult] = await Promise.all([
          eventResponse.json(), tasksResponse.json(), guestsResponse.json(),
        ]);
        setDetail(eventResult);
        setTasks(taskResult.tasks ?? []);
        setGuests(guestResult.items ?? []);
      })
      .catch((error: Error) => setFeedback(error.message));
  }, [payload.accessToken, selectedEvent]);

  useEffect(() => {
    if (detailPanel !== 'vendors') return;
    setIsLoadingListings(true);
    const params = new URLSearchParams();
    if (vendorSearch) params.set('q', vendorSearch);
    if (selectedEvent?.city) params.set('city', selectedEvent.city);
    if (selectedEvent?.currency) params.set('currency', selectedEvent.currency);
    fetch(`/api/v1/listings${params.toString() ? `?${params.toString()}` : ''}`, { headers: { Authorization: `Bearer ${payload.accessToken}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load vendors.');
        return response.json();
      })
      .then((result) => setListings(result.items ?? []))
      .catch((error: Error) => setFeedback(error.message))
      .finally(() => setIsLoadingListings(false));
  }, [detailPanel, payload.accessToken, vendorSearch, selectedEvent?.city, selectedEvent?.currency]);

  const createEvent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) return;
    setIsCreating(true);
    setFeedback('');
    try {
      const response = await fetch('/api/v1/events', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${payload.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          type: eventType,
          startsAt: eventDate ? new Date(`${eventDate}T10:00:00`).toISOString() : null,
          city: eventCity.trim() || null,
          country: eventCountry.trim().toUpperCase() || null,
          expectedGuests: expectedGuests ? Number(expectedGuests) : null,
          currency: eventCurrency,
          isPublic: false,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error?.message || 'Unable to create the event.');
      setEvents((current) => [result.event, ...current]);
      const draft = draftRef.current;
      if (draft && result.event?.id) {
        await Promise.allSettled((NEEDS_BY_TYPE[draft.type ?? ''] ?? []).map((need) => fetch(`/api/v1/events/${result.event.id}/tasks`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${payload.accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: `Book ${need.toLowerCase()}` }),
        })));
        localStorage.removeItem('ess:eventDraft');
        draftRef.current = null;
      }
      setTitle('');
      setEventDate('');
      setEventCity('');
      setExpectedGuests('');
      setFeedback('Event created. Your planning workspace is ready.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to create the event.');
    } finally {
      setIsCreating(false);
    }
  };

  const postToEvent = async (path: string, body: Record<string, unknown>, success: string) => {
    const response = await fetch(`/api/v1/events/${selectedEvent?.id}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${payload.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result?.error?.message || 'Unable to save this change.');
    setFeedback(success);
  };

  const addGuest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await postToEvent('/guests', { name: guestName.trim(), phone: guestPhone.trim() || null, email: guestEmail.trim() || null }, 'Guest added.');
      setGuests((current) => [...current, { id: crypto.randomUUID(), name: guestName.trim(), rsvp: 'PENDING', plusOnes: 0 }]);
      setGuestName('');
      setGuestPhone('');
      setGuestEmail('');
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'Unable to add guest.'); }
  };

  const completeTask = async (task: Task) => {
    const nextStatus = task.status === 'DONE' ? 'TODO' : 'DONE';
    try {
      const response = await fetch(`/api/v1/events/${selectedEvent?.id}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${payload.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error?.message || 'Unable to update task.');
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: nextStatus } : item));
      setFeedback(nextStatus === 'DONE' ? 'Task completed.' : 'Task reopened.');
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'Unable to update task.'); }
  };

  const removeTask = async (task: Task) => {
    if (!window.confirm(`Remove "${task.title}" from this checklist?`)) return;
    try {
      const response = await fetch(`/api/v1/events/${selectedEvent?.id}/tasks/${task.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${payload.accessToken}` },
      });
      if (!response.ok) throw new Error('Unable to remove task.');
      setTasks((current) => current.filter((item) => item.id !== task.id));
      setFeedback('Task removed.');
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'Unable to remove task.'); }
  };

  const updateGuestStatus = async (guest: Guest, status: string) => {
    try {
      const response = await fetch(`/api/v1/events/${selectedEvent?.id}/guests/${guest.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${payload.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rsvp: status }),
      });
      if (!response.ok) throw new Error('Unable to update guest status.');
      setGuests((current) => current.map((item) => item.id === guest.id ? { ...item, rsvp: status } : item));
      setFeedback(`Guest marked ${status.toLowerCase()}.`);
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'Unable to update guest status.'); }
  };

  const removeGuest = async (guest: Guest) => {
    if (!window.confirm(`Remove ${guest.name} from the guest list?`)) return;
    try {
      const response = await fetch(`/api/v1/events/${selectedEvent?.id}/guests/${guest.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${payload.accessToken}` },
      });
      if (!response.ok) throw new Error('Unable to remove guest.');
      setGuests((current) => current.filter((item) => item.id !== guest.id));
      setFeedback('Guest removed.');
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'Unable to remove guest.'); }
  };

  const toggleListing = (listingId: string) => {
    setSelectedListings((current) => current.includes(listingId) ? current.filter((id) => id !== listingId) : [...current, listingId]);
  };

  const addTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const response = await fetch(`/api/v1/events/${selectedEvent?.id}/tasks`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${payload.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: taskTitle.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error?.message || 'Unable to add task.');
      setTasks((current) => [...current, result.task]);
      setTaskTitle('');
      setFeedback('Task added.');
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'Unable to add task.'); }
  };

  const addBudgetItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await postToEvent('/budget/items', { label: budgetLabel.trim(), plannedMinor: budgetAmount.trim() ? majorToMinorUnits(budgetAmount) : '0' }, 'Budget item added.');
      setBudgetLabel('');
      setBudgetAmount('');
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'Unable to add budget item.'); }
  };

  if (selectedEvent) {
    return (
      <main className="workspace-shell">
        <button className="back-button" onClick={() => { setSelectedEvent(null); setDetail(null); setDetailPanel('overview'); }}>Back to events</button>
        <header className="workspace-header event-detail-header">
          <div>
            <p className="eyebrow">Event workspace</p>
            <h1>{selectedEvent.title}</h1>
            <p className="workspace-subtitle">{detail?.event.city || 'International event'} · {selectedEvent.status ?? 'DRAFT'}</p>
          </div>
          <button className="secondary-button" onClick={onLogout}>Sign out</button>
        </header>
        <nav className="detail-nav" aria-label="Event sections">
          {(['overview', 'tasks', 'guests', 'budget', 'vendors'] as DetailPanel[]).map((panel) => (
            <button className={detailPanel === panel ? 'detail-nav-button active' : 'detail-nav-button'} key={panel} onClick={() => setDetailPanel(panel)}>
              {panel === 'overview' ? 'Overview' : panel === 'tasks' ? `Tasks (${tasks.length})` : panel === 'guests' ? `Guests (${guests.length})` : panel === 'budget' ? 'Budget' : 'Vendors'}
            </button>
          ))}
        </nav>
        {feedback && <p className="detail-feedback">{feedback}</p>}
        {!detail ? <div className="workspace-card"><p>Loading event details...</p></div> : (
          <section className="detail-grid">
            <div className="workspace-card detail-summary detail-summary-card">
              <p className="eyebrow">Overview</p>
              <h2>Event summary</h2>
              <div className="summary-stats">
                <strong>{detail.summary.guests.expectedHeadcount}<span> guests confirmed</span></strong>
                <strong>{Object.values(detail.summary.tasks).reduce((total, count) => total + count, 0)}<span> tasks</span></strong>
                <strong>{formatMinorCurrency(detail.summary.budget.plannedMinor, detail.summary.budget.currency)}<span> planned</span></strong>
              </div>
              {detailPanel === 'overview' && <div className="next-action"><span>Next recommended step</span><button onClick={() => setDetailPanel(tasks.some((task) => task.status !== 'DONE') ? 'tasks' : guests.length === 0 ? 'guests' : detail.summary.budget.plannedMinor === '0' ? 'budget' : 'vendors')}>{tasks.some((task) => task.status !== 'DONE') ? 'Complete your checklist' : guests.length === 0 ? 'Build your guest list' : detail.summary.budget.plannedMinor === '0' ? 'Complete your budget plan' : 'Find vendors and products'} <span aria-hidden="true">→</span></button></div>}
            </div>
            {(detailPanel === 'overview' || detailPanel === 'tasks') && <div className="workspace-card detail-section-card">
              <div className="section-header"><div><p className="eyebrow">Checklist</p><h2>Tasks</h2></div><strong>{tasks.length}</strong></div>
              <form className="compact-form" onSubmit={addTask}><input aria-label="Task title" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Add a task" required /><button className="primary-button" type="submit">Add</button></form>
              <ul className="detail-list">{(detailPanel === 'tasks' ? tasks : tasks.slice(0, 8)).map((task) => <li key={task.id}><span className={task.status === 'DONE' ? 'completed-item' : ''}>{task.title}</span><span className="row-actions"><button className="status-button" onClick={() => completeTask(task)}>{task.status === 'DONE' ? 'Completed' : 'Mark done'}</button><button className="remove-button" onClick={() => removeTask(task)} aria-label={`Remove ${task.title}`}>Remove</button></span></li>)}</ul>
              {detailPanel !== 'tasks' && tasks.length > 8 && <button className="text-action" onClick={() => setDetailPanel('tasks')}>View full checklist →</button>}
              {detailPanel === 'tasks' && <button className="continue-action" onClick={() => setDetailPanel('guests')}>Continue to guest list <span aria-hidden="true">→</span></button>}
            </div>}
            {(detailPanel === 'overview' || detailPanel === 'guests') && <div className="workspace-card detail-section-card">
              <div className="section-header"><div><p className="eyebrow">Attendance</p><h2>Guests</h2></div><strong>{guests.length}</strong></div>
              <form className="compact-form guest-form" onSubmit={addGuest}><input aria-label="Guest name" value={guestName} onChange={(event) => setGuestName(event.target.value)} placeholder="Full name" required /><input aria-label="Guest phone number" value={guestPhone} onChange={(event) => setGuestPhone(event.target.value)} placeholder="Phone number" type="tel" /><input aria-label="Guest email" value={guestEmail} onChange={(event) => setGuestEmail(event.target.value)} placeholder="Email address" type="email" /><button className="primary-button" type="submit">Add guest</button></form>
              <ul className="detail-list">{guests.slice(0, 8).map((guest) => <li key={guest.id}><span><strong>{guest.name}</strong><small className="guest-status">{guest.rsvp}</small></span><span className="row-actions"><button className="status-button" onClick={() => updateGuestStatus(guest, 'ACCEPTED')}>Confirm</button><button className="status-button pending" onClick={() => updateGuestStatus(guest, 'PENDING')}>Pending</button><button className="status-button cancelled" onClick={() => updateGuestStatus(guest, 'DECLINED')}>Cancel</button><button className="remove-button" onClick={() => removeGuest(guest)}>Remove</button></span></li>)}</ul>
              {detailPanel === 'guests' && <button className="continue-action" onClick={() => setDetailPanel('budget')}>Continue to budget plan <span aria-hidden="true">→</span></button>}
            </div>}
            {(detailPanel === 'overview' || detailPanel === 'budget') && <div className="workspace-card detail-section-card">
              <div className="section-header"><div><p className="eyebrow">Planning costs</p><h2>Budget</h2></div><strong>{detail.summary.budget.currency}</strong></div>
              <p>Planned: {formatMinorCurrency(detail.summary.budget.plannedMinor, detail.summary.budget.currency)} · Actual: {formatMinorCurrency(detail.summary.budget.actualMinor, detail.summary.budget.currency)}</p>
              <form className="compact-form" onSubmit={addBudgetItem}><input aria-label="Budget item" value={budgetLabel} onChange={(event) => setBudgetLabel(event.target.value)} placeholder="Budget item" required /><input aria-label="Planned amount" value={budgetAmount} onChange={(event) => setBudgetAmount(formatMoneyInput(event.target.value))} onBlur={() => setBudgetAmount((current) => formatMoneyInput(current, true))} placeholder="5,000,000.00" inputMode="decimal" required /><button className="primary-button" type="submit">Add</button></form>
              {detailPanel === 'budget' && <button className="continue-action" onClick={() => setDetailPanel('vendors')}>Continue to vendors <span aria-hidden="true">→</span></button>}
            </div>}
            {detailPanel === 'vendors' && <div className="workspace-card detail-section-card vendor-panel">
              <div className="section-header"><div><p className="eyebrow">Marketplace mission</p><h2>Find vendors & select products</h2></div><strong>{selectedListings.length} in cart</strong></div>
              <p>Search active vendor products that fit this event. Select the services you want to compare or book next.</p>
              {selectedListings.length > 0 && <div className="cart-summary"><div><strong>Your event cart</strong><span>{selectedListings.length} product{selectedListings.length === 1 ? '' : 's'} selected for review</span></div><div className="cart-items">{listings.filter((listing) => selectedListings.includes(listing.id)).map((listing) => <span key={listing.id}>{listing.title}<button onClick={() => toggleListing(listing.id)} aria-label={`Remove ${listing.title} from cart`}>×</button></span>)}</div></div>}
              <form className="vendor-search" onSubmit={(event) => event.preventDefault()}><input aria-label="Search vendors and products" value={vendorSearch} onChange={(event) => setVendorSearch(event.target.value)} placeholder="Search catering, decor, photography..." /><button className="primary-button" type="submit">Search</button></form>
              {isLoadingListings ? <p>Looking for available vendors...</p> : listings.length === 0 ? <div className="empty-marketplace"><strong>No active products found yet.</strong><span>Vendors will appear here when active listings are available for this marketplace.</span></div> : <div className="listing-grid">{listings.map((listing) => <article className={selectedListings.includes(listing.id) ? 'listing-card selected' : 'listing-card'} key={listing.id}><p className="eyebrow">{listing.category?.name || listing.type}</p><h3>{listing.title}</h3><p>{listing.description || 'Verified event service from an active vendor.'}</p><footer><span>{listing.vendor?.businessName || 'Verified vendor'}{listing.city ? ` · ${listing.city}` : ''}</span><strong>{formatMinorCurrency(listing.priceMinor, listing.currency)}</strong></footer><button className="select-listing" onClick={() => toggleListing(listing.id)}>{selectedListings.includes(listing.id) ? 'Selected ✓' : 'Select product'}</button></article>)}</div>}
            </div>}
          </section>
        )}
      </main>
    );
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Client workspace · EPHINTA</p>
          <h1>Welcome, {payload.user.name}</h1>
          <p className="workspace-subtitle">Your event planning workspace is ready. Sign out to switch to a vendor account.</p>
        </div>
        <button className="secondary-button" onClick={onLogout}>Sign out</button>
      </header>

      <section className="workspace-grid">
        <div className="workspace-card workspace-intro">
          <p className="eyebrow">Next step</p>
          <h2>Start planning your first event</h2>
          <p>Create an event, then add guests, tasks, and budget items from your workspace.</p>
          <form onSubmit={createEvent} className="event-form">
            <input
              aria-label="Event name"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Lagos product launch"
              required
            />
            <div className="event-form-grid">
              <select aria-label="Event type" value={eventType} onChange={(event) => setEventType(event.target.value)}>
                <option value="PERSONAL">Personal</option><option value="CORPORATE">Corporate</option><option value="SOCIAL">Social</option><option value="SPORTS">Sports</option><option value="CULTURAL">Cultural</option><option value="RELIGIOUS">Religious</option><option value="ENTERTAINMENT">Entertainment</option><option value="EDUCATIONAL">Educational</option><option value="VIRTUAL">Virtual</option>
              </select>
              <input aria-label="Event date" type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
              <input aria-label="City" value={eventCity} onChange={(event) => setEventCity(event.target.value)} placeholder="City" />
              <input aria-label="Country code" value={eventCountry} onChange={(event) => setEventCountry(event.target.value)} placeholder="Country (NG)" maxLength={2} />
              <input aria-label="Expected guests" value={expectedGuests} onChange={(event) => setExpectedGuests(event.target.value)} placeholder="Expected guests" inputMode="numeric" type="number" min="1" />
              <select aria-label="Currency" value={eventCurrency} onChange={(event) => setEventCurrency(event.target.value)}><option value="NGN">NGN</option><option value="USD">USD</option><option value="GBP">GBP</option><option value="EUR">EUR</option></select>
            </div>
            <button className="primary-button" disabled={isCreating} type="submit">
              {isCreating ? 'Creating...' : 'Create event'}
            </button>
          </form>
          {feedback && <p className="workspace-feedback">{feedback}</p>}
        </div>

        <div className="workspace-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Your workspace</p>
              <h2>Events</h2>
            </div>
            <strong>{events.length}</strong>
          </div>
          {isLoading ? <p>Loading your events...</p> : events.length === 0 ? (
            <p>No events yet. Create your first one to begin.</p>
          ) : (
            <div className="event-list">
              {events.map((event) => (
                <button className="event-row event-row-button" key={event.id} onClick={() => setSelectedEvent(event)}>
                  <strong>{event.title}</strong>
                  <span>{event.status ?? 'DRAFT'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [auth, setAuth] = useState<AuthPayload | null>(() => {
    const user = localStorage.getItem('ess_user');
    const accessToken = localStorage.getItem('ess_access_token');
    const refreshToken = localStorage.getItem('ess_refresh_token');
    if (!user || !accessToken || !refreshToken) return null;
    return { user: JSON.parse(user), accessToken, refreshToken };
  });
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const hasRestoredSession = useRef(false);

  useEffect(() => {
    if (hasRestoredSession.current) return;
    hasRestoredSession.current = true;
    const refreshToken = localStorage.getItem('ess_refresh_token');
    if (!refreshToken) {
      setIsRestoringSession(false);
      return;
    }

    fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Session expired');
        return response.json() as Promise<AuthPayload>;
      })
      .then((payload) => {
        localStorage.setItem('ess_access_token', payload.accessToken);
        localStorage.setItem('ess_refresh_token', payload.refreshToken);
        localStorage.setItem('ess_user', JSON.stringify(payload.user));
        setAuth(payload);
      })
      .catch(() => {
        localStorage.removeItem('ess_access_token');
        localStorage.removeItem('ess_refresh_token');
        localStorage.removeItem('ess_user');
        setAuth(null);
      })
      .finally(() => setIsRestoringSession(false));
  }, []);

  const handleLoginSuccess = (payload: AuthPayload) => {
    localStorage.setItem('ess_access_token', payload.accessToken);
    localStorage.setItem('ess_refresh_token', payload.refreshToken);
    localStorage.setItem('ess_user', JSON.stringify(payload.user));
    setAuth(payload);
  };

  const handleLogout = () => {
    localStorage.removeItem('ess_access_token');
    localStorage.removeItem('ess_refresh_token');
    localStorage.removeItem('ess_user');
    setAuth(null);
  };

  if (isRestoringSession) return <main className="session-loading">Restoring your secure session...</main>;

  const appContent = auth ? (
    auth.user.role === 'VENDOR' ? (
      <VendorPortal payload={auth} onLogout={handleLogout} />
    ) : (
      <Workspace payload={auth} onLogout={handleLogout} />
    )
  ) : (
    <SplashLogo><PublicLanding onLoginSuccess={handleLoginSuccess} /></SplashLogo>
  );

  return (
    <>
      {appContent}
      <AudioExperience showPrompt={false} />
    </>
  );
}