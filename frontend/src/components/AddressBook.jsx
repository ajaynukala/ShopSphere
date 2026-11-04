
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../config/supabase";

const emptyAddress = {
  full_name: "",
  phone: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "India",
  is_default: false,
};

function AddressBook({ user, onBack }) {
  const [addresses, setAddresses] = useState([]);
  const [formData, setFormData] = useState({ ...emptyAddress });
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingDefaultId, setSettingDefaultId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const fetchAddresses = useCallback(async (showLoader = true) => {
    if (!user?.id) return;

    if (showLoader) setLoading(true);
    setError("");

    try {
      const { data, error: fetchError } = await supabase
        .from("customer_addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      setAddresses(data || []);
    } catch (err) {
      console.error("Address loading error:", err.message);
      setError("We couldn't load your saved addresses. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function openAddForm() {
    setEditingId(null);
    setFormData({ ...emptyAddress });
    setError("");
    setMessage("");
    setShowForm(true);
  }

  function openEditForm(address) {
    setEditingId(address.id);
    setFormData({
      full_name: address.full_name || "",
      phone: address.phone || "",
      address_line1: address.address_line1 || "",
      address_line2: address.address_line2 || "",
      city: address.city || "",
      state: address.state || "",
      postal_code: address.postal_code || "",
      country: address.country || "India",
      is_default: address.is_default || false,
    });

    setError("");
    setMessage("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setFormData({ ...emptyAddress });
  }

  async function makeDefault(addressId) {
    const { error: defaultError } = await supabase.rpc(
      "set_default_customer_address",
      { p_address_id: addressId }
    );

    if (defaultError) throw defaultError;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!user?.id) {
      setError("Please sign in to manage your addresses.");
      return;
    }

    setSaving(true);

    const addressData = {
      full_name: formData.full_name.trim(),
      phone: formData.phone.trim(),
      address_line1: formData.address_line1.trim(),
      address_line2: formData.address_line2.trim() || null,
      city: formData.city.trim(),
      state: formData.state.trim(),
      postal_code: formData.postal_code.trim(),
      country: formData.country.trim(),
    };

    try {
      let savedAddressId = editingId;

      if (editingId) {
        const { error: updateError } = await supabase
          .from("customer_addresses")
          .update(addressData)
          .eq("id", editingId)
          .eq("user_id", user.id);

        if (updateError) throw updateError;
      } else {
        // A customer with no saved addresses must receive a default.
        const shouldBeDefault =
          addresses.length === 0 || formData.is_default;

        // Insert as non-default first to avoid the unique index conflict.
        const { data, error: insertError } = await supabase
          .from("customer_addresses")
          .insert({
            ...addressData,
            user_id: user.id,
            is_default: false,
          })
          .select("id")
          .single();

        if (insertError) throw insertError;

        savedAddressId = data.id;

        if (shouldBeDefault) {
          await makeDefault(savedAddressId);
        }
      }

      if (editingId && formData.is_default && savedAddressId) {
        await makeDefault(savedAddressId);
      }

      const wasFirstAddress =
        !editingId && addresses.length === 0;

      setMessage(
        wasFirstAddress
          ? "Address saved and automatically set as your default."
          : formData.is_default && !editingId
            ? "Address saved and set as your default."
            : editingId && formData.is_default
              ? "Address updated successfully."
              : editingId
                ? "Address updated successfully."
                : "Address added successfully."
      );

      closeForm();
      await fetchAddresses(false);
    } catch (err) {
      console.error("Address save error:", err.message);
      setError(
        "We couldn't save your address. Please check the details and try again."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(addressId) {
    setError("");
    setMessage("");
    setSettingDefaultId(addressId);

    try {
      await makeDefault(addressId);
      await fetchAddresses(false);
      setMessage("Your default delivery address has been updated.");
    } catch (err) {
      console.error("Default address error:", err.message);
      setError("We couldn't change your default address. Please try again.");
    } finally {
      setSettingDefaultId(null);
    }
  }

  async function handleDelete(addressId) {
    const addressToDelete = addresses.find(
      (address) => address.id === addressId
    );

    if (!addressToDelete) return;

    const confirmed = window.confirm(
      addressToDelete.is_default
        ? addresses.length === 1
          ? "This is your only saved address. Deleting it will leave your address book empty. Continue?"
          : "This is your default address. Another saved address will automatically become your default. Continue?"
        : "Are you sure you want to delete this saved address?"
    );

    if (!confirmed) return;

    setError("");
    setMessage("");
    setDeletingId(addressId);

    try {
      // The database function deletes the address and promotes
      // the oldest remaining address when the deleted one was default.
      const { error: deleteError } = await supabase.rpc(
        "delete_customer_address",
        { p_address_id: addressId }
      );

      if (deleteError) throw deleteError;

      await fetchAddresses(false);

      setMessage(
        addressToDelete.is_default && addresses.length > 1
          ? "Address deleted. Another saved address is now your default."
          : "Address deleted successfully."
      );
    } catch (err) {
      console.error("Address deletion error:", err.message);
      setError("We couldn't delete this address. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  const isEditingDefault = addresses.some(
    (address) => address.id === editingId && address.is_default
  );

  if (loading) {
    return (
      <section className="address-book">
        <div className="address-loading">
          <span className="address-loading-icon">⌖</span>
          <p>Loading your saved addresses...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="address-book">
      <div className="address-page-top">
        <button
          type="button"
          className="address-back-button"
          onClick={onBack}
        >
          <span aria-hidden="true">←</span> Back to shopping
        </button>

        <div className="address-heading">
          <div>
            <span className="address-eyebrow">YOUR ACCOUNT</span>
            <h1>My Addresses</h1>
            <p>
              Save and manage the places where you'd like your orders delivered.
            </p>
          </div>

          {!showForm && (
            <button
              type="button"
              className="address-primary-button"
              onClick={openAddForm}
            >
              <span aria-hidden="true">＋</span> Add new address
            </button>
          )}
        </div>

        <div className="address-overview">
          <div className="address-overview-icon" aria-hidden="true">⌂</div>
          <div>
            <strong>
              {addresses.length}{" "}
              {addresses.length === 1 ? "saved address" : "saved addresses"}
            </strong>
            <span>
              {addresses.length === 0
                ? "Add an address to get started."
                : addresses.some((address) => address.is_default)
                  ? "Your preferred delivery address is ready."
                  : "Choose a default address for a quicker checkout."}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="address-alert address-alert-error" role="alert">
          <span aria-hidden="true">!</span>
          {error}
        </div>
      )}

      {message && (
        <div className="address-alert address-alert-success" role="status">
          <span aria-hidden="true">✓</span>
          {message}
        </div>
      )}

      {showForm && (
        <form className="address-editor" onSubmit={handleSubmit}>
          <div className="address-editor-heading">
            <div>
              <span className="address-eyebrow">
                {editingId ? "UPDATE DETAILS" : "NEW DELIVERY LOCATION"}
              </span>
              <h2>{editingId ? "Edit address" : "Add a new address"}</h2>
              <p>
                Enter the details exactly as they should appear on your delivery.
              </p>
            </div>

            <button
              type="button"
              className="address-close-button"
              onClick={closeForm}
              disabled={saving}
              aria-label="Close address form"
            >
              ×
            </button>
          </div>

          <div className="address-form-section">
            <h3>Contact details</h3>

            <div className="address-input-grid">
              <label className="address-field">
                <span>Full name <b>*</b></span>
                <input
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  maxLength={100}
                  placeholder="Name of the recipient"
                  autoComplete="name"
                  required
                />
              </label>

              <label className="address-field">
                <span>Phone number <b>*</b></span>
                <input
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  maxLength={25}
                  placeholder="Contact number"
                  autoComplete="tel"
                  required
                />
              </label>
            </div>
          </div>

          <div className="address-form-section">
            <h3>Delivery address</h3>

            <div className="address-input-grid">
              <label className="address-field address-field-full">
                <span>Address line 1 <b>*</b></span>
                <input
                  name="address_line1"
                  value={formData.address_line1}
                  onChange={handleChange}
                  maxLength={200}
                  placeholder="House / flat number, building, street"
                  autoComplete="address-line1"
                  required
                />
              </label>

              <label className="address-field address-field-full">
                <span>Address line 2 <small>Optional</small></span>
                <input
                  name="address_line2"
                  value={formData.address_line2}
                  onChange={handleChange}
                  maxLength={200}
                  placeholder="Landmark, area, apartment"
                  autoComplete="address-line2"
                />
              </label>

              <label className="address-field">
                <span>City <b>*</b></span>
                <input
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  maxLength={100}
                  autoComplete="address-level2"
                  required
                />
              </label>

              <label className="address-field">
                <span>State <b>*</b></span>
                <input
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  maxLength={100}
                  autoComplete="address-level1"
                  required
                />
              </label>

              <label className="address-field">
                <span>Postal code <b>*</b></span>
                <input
                  name="postal_code"
                  value={formData.postal_code}
                  onChange={handleChange}
                  maxLength={20}
                  autoComplete="postal-code"
                  required
                />
              </label>

              <label className="address-field">
                <span>Country <b>*</b></span>
                <input
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  maxLength={100}
                  autoComplete="country-name"
                  required
                />
              </label>
            </div>
          </div>

          {!isEditingDefault && (
            <label className="address-default-option">
              <input
                type="checkbox"
                name="is_default"
                checked={formData.is_default}
                onChange={handleChange}
              />
              <span className="address-custom-check" aria-hidden="true">✓</span>
              <span>
                <strong>Make this my default address</strong>
                <small>
                  Use this address as your preferred delivery location.
                </small>
              </span>
            </label>
          )}

          {isEditingDefault && (
            <div className="address-current-default-note">
              <span aria-hidden="true">✓</span>
              This is currently your default delivery address.
            </div>
          )}

          <div className="address-editor-actions">
            <button
              type="button"
              className="address-secondary-button"
              onClick={closeForm}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="address-primary-button"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Save changes"
                  : "Save address"}
            </button>
          </div>
        </form>
      )}

      {!showForm && addresses.length === 0 && (
        <div className="address-empty-state">
          <div className="address-empty-icon" aria-hidden="true">⌂</div>
          <h2>No saved addresses yet</h2>
          <p>
            Add your first delivery address to make your future ShopSphere
            checkouts quicker and easier.
          </p>
          <button
            type="button"
            className="address-primary-button"
            onClick={openAddForm}
          >
            ＋ Add your first address
          </button>
        </div>
      )}

      {!showForm && addresses.length > 0 && (
        <div className="address-results">
          <div className="address-results-heading">
            <h2>Your saved locations</h2>
            <span>{addresses.length} total</span>
          </div>

          <div className="address-grid">
            {addresses.map((address) => (
              <article
                className={`address-card ${address.is_default ? "is-default" : ""}`}
                key={address.id}
              >
                <div className="address-card-top">
                  <div className="address-type-icon" aria-hidden="true">⌂</div>

                  {address.is_default ? (
                    <span className="address-default-badge">
                      <span aria-hidden="true">✓</span> DEFAULT
                    </span>
                  ) : (
                    <span className="address-saved-label">SAVED ADDRESS</span>
                  )}
                </div>

                <h3>{address.full_name}</h3>
                <p className="address-card-phone">{address.phone}</p>

                <div className="address-card-divider" />

                <div className="address-card-location">
                  <p>{address.address_line1}</p>
                  {address.address_line2 && <p>{address.address_line2}</p>}
                  <p>
                    {address.city}, {address.state} - {address.postal_code}
                  </p>
                  <p>{address.country}</p>
                </div>

                <div className="address-card-actions">
                  <button
                    type="button"
                    className="address-edit-button"
                    onClick={() => openEditForm(address)}
                    disabled={deletingId !== null || settingDefaultId !== null}
                  >
                    Edit details
                  </button>

                  {!address.is_default && (
                    <button
                      type="button"
                      className="address-make-default-button"
                      onClick={() => handleSetDefault(address.id)}
                      disabled={settingDefaultId !== null || deletingId !== null}
                    >
                      {settingDefaultId === address.id
                        ? "Updating..."
                        : "Make default"}
                    </button>
                  )}

                  <button
                    type="button"
                    className="address-delete-button"
                    onClick={() => handleDelete(address.id)}
                    disabled={deletingId !== null || settingDefaultId !== null}
                    aria-label={`Delete address for ${address.full_name}`}
                  >
                    {deletingId === address.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default AddressBook;
