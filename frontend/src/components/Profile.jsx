import { useEffect, useState } from "react";
import { supabase } from "../config/supabase";

function Profile({ user, onBack }) {
  const [profile, setProfile] = useState(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editing, setEditing] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Fetch the customer's profile from PostgreSQL.
  useEffect(() => {
    async function fetchProfile() {
      if (!user?.id) {
        setError("Please sign in to view your profile.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, phone, avatar_url, created_at")
        .eq("id", user.id)
        .single();

      if (profileError) {
        setError(profileError.message);
      } else {
        setProfile(data);
        setFullName(data.full_name || "");
        setPhone(data.phone || "");
      }

      setLoading(false);
    }

    fetchProfile();
  }, [user?.id]);

  // Generate a temporary preview for the selected image.
  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  function handleFileChange(event) {
    setError("");
    setMessage("");

    const file = event.target.files?.[0];

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError("Please select a JPEG, PNG or WebP image.");
      event.target.value = "";
      setSelectedFile(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Your profile picture must not exceed 5 MB.");
      event.target.value = "";
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  }

  // Upload the profile picture to Supabase Storage.
  async function handleAvatarUpload() {
    if (!selectedFile || !user?.id) {
      setError("Please select an image first.");
      return;
    }

    setUploadingAvatar(true);
    setError("");
    setMessage("");

    let uploadedPath = null;

    try {
      const extensions = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      };

      const extension = extensions[selectedFile.type];

      if (!extension) {
        throw new Error("Unsupported image format.");
      }

      // Give every uploaded image a unique filename.
      uploadedPath =
        `${user.id}/${crypto.randomUUID()}.${extension}`;

      // Upload the image to the customer's own folder.
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(uploadedPath, selectedFile, {
          contentType: selectedFile.type,
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Generate the public URL for the uploaded image.
      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(uploadedPath);

      const avatarUrl = publicUrlData.publicUrl;

      // Save the image URL in the customer's PostgreSQL profile.
      const { data: updatedProfile, error: updateError } =
        await supabase
          .from("profiles")
          .update({
            avatar_url: avatarUrl,
          })
          .eq("id", user.id)
          .select("full_name, phone, avatar_url, created_at")
          .single();

      if (updateError) {
        throw updateError;
      }

      // Update the displayed profile.
      const previousAvatarUrl = profile?.avatar_url;

      setProfile(updatedProfile);
      setSelectedFile(null);

      setMessage("Your profile picture has been updated successfully.");

      // Remove the previous picture after the new one is saved.
      if (previousAvatarUrl) {
        try {
          const marker =
            "/storage/v1/object/public/avatars/";

          const previousUrl = new URL(previousAvatarUrl);
          const markerIndex = previousUrl.pathname.indexOf(marker);

          if (markerIndex !== -1) {
            const previousPath = decodeURIComponent(
              previousUrl.pathname.slice(markerIndex + marker.length)
            );

            // Only delete files inside this customer's own folder.
            if (previousPath.startsWith(`${user.id}/`)) {
              const { error: deleteError } = await supabase.storage
                .from("avatars")
                .remove([previousPath]);

              if (deleteError) {
                console.error(
                  "Previous avatar cleanup failed:",
                  deleteError.message
                );
              }
            }
          }
        } catch (cleanupError) {
          console.error(
            "Previous avatar cleanup failed:",
            cleanupError.message
          );
        }
      }
    } catch (uploadError) {
      // Remove the newly uploaded image if saving its URL failed.
      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage
          .from("avatars")
          .remove([uploadedPath]);

        if (cleanupError) {
          console.error(
            "Avatar cleanup failed:",
            cleanupError.message
          );
        }
      }

      setError(
        uploadError.message || "Unable to upload your profile picture."
      );
    } finally {
      setUploadingAvatar(false);
    }
  }

  function cancelEditing() {
    setFullName(profile.full_name || "");
    setPhone(profile.phone || "");
    setEditing(false);
    setError("");
    setMessage("");
  }

  async function handleSave(event) {
    event.preventDefault();

    setError("");
    setMessage("");

    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim();

    if (trimmedName.length < 2 || trimmedName.length > 100) {
      setError("Name must contain between 2 and 100 characters.");
      return;
    }

    if (
      trimmedPhone &&
      !/^[0-9+() -]{7,25}$/.test(trimmedPhone)
    ) {
      setError("Please enter a valid phone number.");
      return;
    }

    setSaving(true);

    try {
      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: trimmedName,
          phone: trimmedPhone || null,
        })
        .eq("id", user.id)
        .select("full_name, phone, avatar_url, created_at")
        .single();

      if (updateError) {
        throw updateError;
      }

      setProfile(data);
      setFullName(data.full_name || "");
      setPhone(data.phone || "");
      setEditing(false);

      setMessage("Your profile has been updated successfully.");
    } catch (updateError) {
      setError(
        updateError.message || "Unable to update your profile."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="profile-page">
      <button
        type="button"
        className="back-button"
        onClick={onBack}
      >
        ← Back to shopping
      </button>

      <div className="profile-card">
        <p className="eyebrow">MY ACCOUNT</p>

        <h1>Customer Profile</h1>

        <p className="auth-description">
          Manage your ShopSphere account information.
        </p>

        {loading && <p>Loading your profile...</p>}

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        {message && (
          <p className="auth-message" role="status">
            {message}
          </p>
        )}

        {!loading && profile && (
          <>
            {/* Profile picture section */}
            <div className="profile-avatar-section">
              <div className="profile-avatar">
                {previewUrl || profile.avatar_url ? (
                  <img
                    src={previewUrl || profile.avatar_url}
                    alt="Customer profile"
                  />
                ) : (
                  <span>
                    {(profile.full_name || user.email || "U")
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                )}
              </div>

              <div className="avatar-upload-controls">
                <label htmlFor="avatar-upload">
                  Choose profile picture
                </label>

                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  disabled={uploadingAvatar}
                />

                <small>
                  JPEG, PNG or WebP. Maximum size: 5 MB.
                </small>

                {selectedFile && (
                  <button
                    type="button"
                    className="add-to-cart-button avatar-upload-button"
                    onClick={handleAvatarUpload}
                    disabled={uploadingAvatar}
                  >
                    {uploadingAvatar
                      ? "Uploading..."
                      : "Upload Picture"}
                  </button>
                )}
              </div>
            </div>

            <div className="profile-section-divider"></div>

            {editing ? (
              <form onSubmit={handleSave}>
                <div className="profile-field">
                  <label htmlFor="profile-name">
                    Full name
                  </label>

                  <input
                    id="profile-name"
                    type="text"
                    value={fullName}
                    onChange={(event) =>
                      setFullName(event.target.value)
                    }
                    minLength={2}
                    maxLength={100}
                    autoComplete="name"
                    required
                  />
                </div>

                <div className="profile-field">
                  <label htmlFor="profile-email">
                    Email address
                  </label>

                  <input
                    id="profile-email"
                    type="email"
                    value={user.email || ""}
                    disabled
                  />

                  <small>
                    Your email is managed by Supabase Authentication.
                  </small>
                </div>

                <div className="profile-field">
                  <label htmlFor="profile-phone">
                    Phone number
                  </label>

                  <input
                    id="profile-phone"
                    type="tel"
                    value={phone}
                    onChange={(event) =>
                      setPhone(event.target.value)
                    }
                    placeholder="Enter your phone number"
                    maxLength={25}
                    autoComplete="tel"
                  />
                </div>

                <div className="profile-form-actions">
                  <button
                    type="submit"
                    className="add-to-cart-button"
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>

                  <button
                    type="button"
                    className="profile-cancel-button"
                    onClick={cancelEditing}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="profile-details">
                  <div className="profile-row">
                    <span>Full name</span>
                    <strong>
                      {profile.full_name || "Not provided"}
                    </strong>
                  </div>

                  <div className="profile-row">
                    <span>Email address</span>
                    <strong>{user.email}</strong>
                  </div>

                  <div className="profile-row">
                    <span>Phone number</span>
                    <strong>
                      {profile.phone || "Not provided"}
                    </strong>
                  </div>

                  <div className="profile-row">
                    <span>Account created</span>
                    <strong>
                      {new Date(
                        profile.created_at
                      ).toLocaleDateString()}
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="add-to-cart-button profile-edit-button"
                  onClick={() => {
                    setEditing(true);
                    setMessage("");
                    setError("");
                  }}
                >
                  Edit Profile
                </button>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default Profile;
