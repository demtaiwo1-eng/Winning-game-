import { useEffect, useState } from "react";
import { feedbackApi, type FeedbackBooking } from "../lib/api";
import { formatMoney, type CurrencyCode, type LocaleCode } from "../lib/i18n";

export default function FeedbackPanel({ locale = "en" }: { locale?: LocaleCode }) {
  const [bookings, setBookings] = useState<FeedbackBooking[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyBooking, setBusyBooking] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    feedbackApi
      .eligibleBookings()
      .then(({ items }) => {
        if (!cancelled) setBookings(items);
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>, bookingId: string) => {
    event.preventDefault();
    setBusyBooking(bookingId);
    setMessage("");
    setError("");
    try {
      await feedbackApi.submit({
        bookingId,
        rating: ratings[bookingId] ?? 5,
        comment: comments[bookingId]?.trim(),
      });
      setBookings((current) => current.filter((booking) => booking.id !== bookingId));
      setMessage("Thank you. Your feedback has been published to the provider’s rating.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to submit feedback.");
    } finally {
      setBusyBooking(null);
    }
  };

  return (
    <section className="ess-panel">
      <p className="ess-eyebrow">After the event</p>
      <h2>Share feedback</h2>
      <p className="ess-muted">
        Feedback is available after you confirm a completed booking. Your rating helps other planners assess providers.
      </p>
      {loading ? (
        <p className="ess-muted">Loading completed bookings…</p>
      ) : bookings.length === 0 && !error ? (
        <p className="ess-muted">There are no completed bookings waiting for feedback.</p>
      ) : (
        <div className="ess-portal-stack">
          {bookings.map((booking) => (
            <form
              className="ess-panel"
              key={booking.id}
              onSubmit={(event) => submit(event, booking.id)}
            >
              <h3>{booking.vendor.businessName}</h3>
              <p className="ess-muted">
                {booking.items.map((item) => `${item.title} × ${item.quantity}`).join(", ")}
                {" · "}
                {formatMoney(booking.totalMinor, booking.currency as CurrencyCode, locale)}
                {" · "}
                Completed {new Date(booking.completedAt).toLocaleDateString()}
              </p>
              <label>
                Your rating
                <select
                  value={ratings[booking.id] ?? 5}
                  onChange={(event) =>
                    setRatings((current) => ({
                      ...current,
                      [booking.id]: Number(event.target.value),
                    }))
                  }
                  required
                >
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <option key={rating} value={rating}>
                      {rating} / 5
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Comment (optional)
                <textarea
                  value={comments[booking.id] ?? ""}
                  maxLength={2000}
                  onChange={(event) =>
                    setComments((current) => ({
                      ...current,
                      [booking.id]: event.target.value,
                    }))
                  }
                />
              </label>
              <button
                type="submit"
                className="ess-primary"
                disabled={busyBooking !== null}
              >
                {busyBooking === booking.id ? "Submitting…" : "Submit feedback"}
              </button>
            </form>
          ))}
        </div>
      )}
      {error && <p className="ess-form-error" role="alert">{error}</p>}
      {message && <p className="ess-form-error" role="status">{message}</p>}
    </section>
  );
}
