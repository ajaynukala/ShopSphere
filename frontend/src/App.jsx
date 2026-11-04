import { supabase } from "./config/supabase";
import { useEffect, useRef, useState } from "react";
import "./App.css";
import Register from "./components/Register";
import Login from "./components/Login";
import Profile from "./components/Profile";
import AddressBook from "./components/AddressBook";

const API_URL = "http://localhost:5001/api/products";

function formatPrice(price) {
  return `₹${Number(price).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function App() {
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [profileSummary, setProfileSummary] = useState(null);
  const accountMenuRef = useRef(null);
  const [showRegister, setShowRegister] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showAddresses, setShowAddresses] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortOrder, setSortOrder] = useState("newest");

  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [cartItems, setCartItems] = useState(() => {
  try {
    const savedCart = localStorage.getItem("shopsphere-cart");

    if (!savedCart) {
      return [];
    }

    const parsedCart = JSON.parse(savedCart);

    if (!Array.isArray(parsedCart)) {
      return [];
    }

    return parsedCart.filter((item) => {
      return (
        item &&
        (typeof item.id === "string" ||
          typeof item.id === "number") &&
        typeof item.name === "string" &&
        Number.isFinite(Number(item.price)) &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0
      );
    });
  } catch (error) {
    console.error("Could not restore saved cart:", error);
    return [];
  }
});
//For Menu
useEffect(() => {
  let isMounted = true;

  async function loadProfileSummary() {
    if (!currentUser?.id) {
      setProfileSummary(null);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (!isMounted) return;

    if (error) {
      console.error("Unable to load account profile:", error.message);
      setProfileSummary(null);
      return;
    }

    setProfileSummary(data);
  }

  loadProfileSummary();

  return () => {
    isMounted = false;
  };
}, [currentUser?.id]);
useEffect(() => {
  if (!showAccountMenu) return;

  function handleOutsideClick(event) {
    if (
      accountMenuRef.current &&
      !accountMenuRef.current.contains(event.target)
    ) {
      setShowAccountMenu(false);
    }
  }

  function handleEscapeKey(event) {
    if (event.key === "Escape") {
      setShowAccountMenu(false);
    }
  }

  document.addEventListener("mousedown", handleOutsideClick);
  document.addEventListener("keydown", handleEscapeKey);

  return () => {
    document.removeEventListener("mousedown", handleOutsideClick);
    document.removeEventListener("keydown", handleEscapeKey);
  };
}, [showAccountMenu]);
// Restore and monitor the Supabase authentication session.
useEffect(() => {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(
    (event, session) => {
      setCurrentUser(session?.user ?? null);
    }
  );

  return () => {
    subscription.unsubscribe();
  };
}, []);
async function handleLogout() {
  setLogoutError("");

  const { error } = await supabase.auth.signOut();

  if (error) {
    setLogoutError(error.message);
    return;
  }

  setCurrentUser(null);
  returnToCatalogue();
}
useEffect(() => {
  try {
    localStorage.setItem(
      "shopsphere-cart",
      JSON.stringify(cartItems)
    );
  } catch (error) {
    console.error("Could not save cart:", error);
  }
}, [cartItems]);
useEffect(() => {
  // Wait until the product catalogue has loaded.
  if (products.length === 0) {
    return;
  }

  function handleStorageChange(event) {
    if (
      event.key !== "shopsphere-cart" &&
      event.key !== null
    ) {
      return;
    }

    // Another tab cleared its cart storage.
    if (event.newValue === null) {
      setCartItems([]);
      return;
    }

    try {
      const savedCart = JSON.parse(event.newValue);

      if (!Array.isArray(savedCart)) {
        setCartItems([]);
        return;
      }

      const updatedCart = savedCart
        .filter((item) => {
          return (
            item &&
            (typeof item.id === "string" ||
              typeof item.id === "number") &&
            Number.isInteger(item.quantity) &&
            item.quantity > 0
          );
        })
        .map((item) => {
          const latestProduct = products.find(
            (product) =>
              String(product.id) === String(item.id)
          );

          if (!latestProduct || latestProduct.stock < 1) {
            return null;
          }

          return {
            ...latestProduct,
            quantity: Math.min(
              item.quantity,
              latestProduct.stock
            ),
          };
        })
        .filter(Boolean);

      setCartItems(updatedCart);
    } catch (error) {
      console.error("Could not synchronise cart:", error);
    }
  }

  window.addEventListener("storage", handleStorageChange);

  return () => {
    window.removeEventListener("storage", handleStorageChange);
  };
}, [products]);
  const [showCart, setShowCart] = useState(false);
  const [cartMessage, setCartMessage] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch all products for the catalogue.
  useEffect(() => {
    async function fetchProducts() {
      try {
        const response = await fetch(API_URL);

        if (!response.ok) {
          throw new Error("Failed to fetch products");
        }

        const result = await response.json();

setProducts(result.data);
// Restore cart items using the latest product information.
setCartItems((currentItems) => {
  return currentItems
    .map((item) => {
      const latestProduct = result.data.find(
        (product) => String(product.id) === String(item.id)
      );

      if (!latestProduct || latestProduct.stock < 1) {
        return null;
      }

      return {
        ...latestProduct,
        quantity: Math.min(item.quantity, latestProduct.stock),
      };
    })
    .filter(Boolean);
});
      } catch {
        setError("Unable to load products. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  // Fetch details for the selected product.
  useEffect(() => {
    if (selectedProductId === null) {
      setSelectedProduct(null);
      setDetailLoading(false);
      setDetailError("");
      return;
    }

    const controller = new AbortController();

    async function fetchProductDetails() {
      setDetailLoading(true);
      setDetailError("");
      setSelectedProduct(null);

      try {
        const response = await fetch(
          `${API_URL}/${selectedProductId}`,
          { signal: controller.signal }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || "Failed to load product details"
          );
        }

        setSelectedProduct(result.data);
      } catch (error) {
        if (error.name !== "AbortError") {
          setDetailError(
            "Unable to load this product. Please try again."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setDetailLoading(false);
        }
      }
    }

    fetchProductDetails();

    return () => controller.abort();
  }, [selectedProductId]);

  const categories = [
    "All",
    ...new Set(products.map((product) => product.category)),
  ];

  const filteredProducts = products.filter((product) => {
    const query = searchTerm.trim().toLowerCase();

    const matchesSearch =
      product.name.toLowerCase().includes(query) ||
      product.description.toLowerCase().includes(query);

    const matchesCategory =
      selectedCategory === "All" ||
      product.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortOrder) {
      case "price-low":
        return Number(a.price) - Number(b.price);
      case "price-high":
        return Number(b.price) - Number(a.price);
      case "name":
        return a.name.localeCompare(b.name);
      case "newest":
      default:
        return new Date(b.created_at) - new Date(a.created_at);
    }
  });

  // Total number of individual items in the cart.
  const cartCount = cartItems.reduce(
    (total, item) => total + item.quantity,
    0
  );

  // Calculate the subtotal from current cart quantities.
  const cartSubtotal = cartItems.reduce(
    (total, item) =>
      total + Number(item.price) * item.quantity,
    0
  );

  function openProduct(productId) {
    setShowRegister(false);
    setShowLogin(false);
    setShowProfile(false);
    setShowAddresses(false);
    setShowCart(false);
    setCartMessage("");
    setSelectedProductId(productId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function returnToCatalogue() {
    setShowRegister(false);
    setShowLogin(false);
    setShowProfile(false);
    setShowAddresses(false);
    setShowCart(false);
    setSelectedProductId(null);
    setCartMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addToCart(product) {
    setCartMessage("");

    if (product.stock < 1) {
      setCartMessage("This product is currently out of stock.");
      return;
    }

    const existingItem = cartItems.find(
      (item) => item.id === product.id
    );

    if (
      existingItem &&
      existingItem.quantity >= product.stock
    ) {
      setCartMessage(
        `Only ${product.stock} unit(s) of this product are available.`
      );
      return;
    }

    setCartItems((currentItems) => {
      const itemExists = currentItems.some(
        (item) => item.id === product.id
      );

      if (itemExists) {
        return currentItems.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...currentItems, { ...product, quantity: 1 }];
    });

    setCartMessage(`${product.name} added to your cart.`);
  }

  async function updateQuantity(productId, newQuantity) {
  const cartItem = cartItems.find(
    (item) => item.id === productId
  );

  if (!cartItem) return;

  if (newQuantity < 1) {
    removeFromCart(productId);
    return;
  }

  try {
    // Fetch the latest product information from the backend.
    const response = await fetch(`${API_URL}/${productId}`);
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error("Unable to verify product availability.");
    }

    const latestProduct = result.data;

    // Check the latest stock from Supabase.
    if (newQuantity > latestProduct.stock) {
      setCartMessage(
        `Only ${latestProduct.stock} unit(s) of ${latestProduct.name} are currently available.`
      );

      // Update the cart with the latest product information.
      setCartItems((currentItems) =>
        currentItems
          .map((item) =>
            item.id === productId
              ? {
                  ...latestProduct,
                  quantity: Math.min(
                    item.quantity,
                    latestProduct.stock
                  ),
                }
              : item
          )
          .filter((item) => item.quantity > 0)
      );

      return;
    }

    setCartMessage("");

    setCartItems((currentItems) =>
      currentItems.map((item) =>
        item.id === productId
          ? {
              ...latestProduct,
              quantity: newQuantity,
            }
          : item
      )
    );
  } catch (error) {
    console.error("Stock validation failed:", error.message);
    setCartMessage(
      "Unable to verify stock. Please try again."
    );
  }
}

  function removeFromCart(productId) {
    setCartItems((currentItems) =>
      currentItems.filter((item) => item.id !== productId)
    );
    setCartMessage("");
  }

  function handleProductCardKeyDown(event, productId) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openProduct(productId);
    }
  }
const accountName =
  profileSummary?.full_name ||
  currentUser?.user_metadata?.full_name ||
  currentUser?.email?.split("@")[0] ||
  "My Account";

const accountEmail = currentUser?.email || "";

const accountAvatar =
  profileSummary?.avatar_url ||
  currentUser?.user_metadata?.avatar_url ||
  "";

const accountInitial = accountName.charAt(0).toUpperCase();
  return (
    <div className="app">
      
<header className="site-header">
  <a
    className="brand"
    href="/"
    onClick={(event) => {
      event.preventDefault();
      returnToCatalogue();
    }}
  >
    ShopSphere
  </a>

  <div className="header-actions">
    {logoutError && (
      <p className="auth-error" role="alert">
        {logoutError}
      </p>
    )}

    <span className="header-label">
      Your everyday marketplace
    </span>

    <div className="account-menu-wrapper" ref={accountMenuRef}>
      <button
        type="button"
        className="account-menu-trigger"
        onClick={() => setShowAccountMenu((previous) => !previous)}
        aria-expanded={showAccountMenu}
        aria-haspopup="true"
        aria-label="Open account menu"
      >
        {currentUser && accountAvatar ? (
          <img
            className="account-menu-avatar"
            src={accountAvatar}
            alt=""
          />
        ) : (
          <span className="account-menu-avatar account-menu-avatar-fallback">
            {currentUser ? accountInitial : "👤"}
          </span>
        )}

        <span className="account-menu-trigger-label">
          {currentUser ? accountName : "Account"}
        </span>

        <span className="account-menu-chevron" aria-hidden="true">
          {showAccountMenu ? "▲" : "▼"}
        </span>
      </button>

      {showAccountMenu && (
        <div className="account-dropdown" role="menu">
          {currentUser ? (
            <>
              <div className="account-dropdown-header">
                <div className="account-dropdown-identity">
                  {accountAvatar ? (
                    <img
                      className="account-dropdown-avatar"
                      src={accountAvatar}
                      alt=""
                    />
                  ) : (
                    <span className="account-dropdown-avatar account-dropdown-avatar-fallback">
                      {accountInitial}
                    </span>
                  )}

                  <div className="account-dropdown-user-details">
                    <strong>{accountName}</strong>
                    <span>{accountEmail}</span>
                  </div>
                </div>

                <span className="account-dropdown-status">
                  Customer account
                </span>
              </div>

              <div className="account-dropdown-divider" />

              <button
                type="button"
                className="account-dropdown-item"
                role="menuitem"
                onClick={() => {
                  setShowAccountMenu(false);
                  setShowRegister(false);
                  setShowLogin(false);
                  setShowProfile(true);
                  setShowAddresses(false);
                  setShowCart(false);
                  setSelectedProductId(null);
                  setCartMessage("");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <span aria-hidden="true">👤</span>
                <span>My Profile</span>
              </button>

              <button
                type="button"
                className="account-dropdown-item"
                role="menuitem"
                onClick={() => {
                  setShowAccountMenu(false);
                  setShowRegister(false);
                  setShowLogin(false);
                  setShowProfile(false);
                  setShowAddresses(true);
                  setShowCart(false);
                  setSelectedProductId(null);
                  setCartMessage("");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <span aria-hidden="true">📍</span>
                <span>My Addresses</span>
              </button>

              <div className="account-dropdown-divider" />

              <button
                type="button"
                className="account-dropdown-item account-dropdown-logout"
                role="menuitem"
                onClick={() => {
                  setShowAccountMenu(false);
                  handleLogout();
                }}
              >
                <span aria-hidden="true">↪</span>
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <>
              <div className="account-dropdown-header">
                <strong>Welcome to ShopSphere</strong>
                <span>Sign in to manage your account.</span>
              </div>

              <div className="account-dropdown-divider" />

              <button
                type="button"
                className="account-dropdown-item"
                role="menuitem"
                onClick={() => {
                  setShowAccountMenu(false);
                  setShowRegister(true);
                  setShowLogin(false);
                  setShowProfile(false);
                  setShowAddresses(false);
                  setShowCart(false);
                  setSelectedProductId(null);
                }}
              >
                <span aria-hidden="true">✦</span>
                <span>Create Account</span>
              </button>

              <button
                type="button"
                className="account-dropdown-item"
                role="menuitem"
                onClick={() => {
                  setShowAccountMenu(false);
                  setShowLogin(true);
                  setShowRegister(false);
                  setShowProfile(false);
                  setShowAddresses(false);
                  setShowCart(false);
                  setSelectedProductId(null);
                }}
              >
                <span aria-hidden="true">→</span>
                <span>Sign In</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>

    <button
      type="button"
      className="cart-header-button"
      onClick={() => {
        setShowCart(true);
        setShowAddresses(false);
        setShowProfile(false);
        setShowRegister(false);
        setShowLogin(false);
        setShowAccountMenu(false);
        setSelectedProductId(null);
        setCartMessage("");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      aria-label={`Open cart, ${cartCount} items`}
    >
      <span aria-hidden="true">🛒</span>
      Cart
      <span className="cart-count">{cartCount}</span>
    </button>
  </div>
</header>


      <main className="container">
{showRegister ? (
  <Register onBack={returnToCatalogue} />
) : showLogin ? (
  <Login
    onBack={returnToCatalogue}
    onLoginSuccess={(user) => {
      setCurrentUser(user);
      setShowLogin(false);
      setShowRegister(false);
      setShowCart(false);
      setSelectedProductId(null);
    }}
  />
) : showProfile ? (
  <Profile
    user={currentUser}
    onBack={returnToCatalogue}
  />
) : showAddresses ? (
  <AddressBook
    user={currentUser}
    onBack={returnToCatalogue}
  />
) : showCart ? (
          <section className="cart-page">
            <button
              type="button"
              className="back-button"
              onClick={returnToCatalogue}
            >
              ← Continue shopping
            </button>

            <div className="cart-heading">
              <div>
                <h1>Your Shopping Cart</h1>
                <p>
                  {cartCount} {cartCount === 1 ? "item" : "items"} in
                  your cart
                </p>
              </div>
            </div>

            {cartMessage && (
              <p className="cart-message" role="status">
                {cartMessage}
              </p>
            )}

            {cartItems.length === 0 ? (
              <div className="empty-cart">
                <span className="empty-cart-icon" aria-hidden="true">
                  🛒
                </span>
                <h2>Your cart is empty</h2>
                <p>Find something you love and add it to your cart.</p>
                <button
                  type="button"
                  className="add-to-cart-button"
                  onClick={returnToCatalogue}
                >
                  Browse products
                </button>
              </div>
            ) : (
              <div className="cart-layout">
                <div className="cart-items">
                  {cartItems.map((item) => (
                    <article className="cart-item" key={item.id}>
                      <div className="cart-item-image">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} />
                        ) : (
                          <span>Product</span>
                        )}
                      </div>

                      <div className="cart-item-info">
                        <p className="category">{item.category}</p>
                        <h2>{item.name}</h2>
                        <p className="cart-item-price">
                          {formatPrice(item.price)}
                        </p>

                        <div className="quantity-controls">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(item.id, item.quantity - 1)
                            }
                            aria-label={`Decrease ${item.name} quantity`}
                          >
                            −
                          </button>

                          <span aria-live="polite">
                            {item.quantity}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(item.id, item.quantity + 1)
                            }
                            disabled={item.quantity >= item.stock}
                            aria-label={`Increase ${item.name} quantity`}
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          className="remove-item-button"
                          onClick={() => removeFromCart(item.id)}
                        >
                          Remove
                        </button>
                      </div>

                      <p className="cart-line-total">
                        {formatPrice(Number(item.price) * item.quantity)}
                      </p>
                    </article>
                  ))}
                </div>

                <aside className="cart-summary">
                  <h2>Order Summary</h2>

                  <div className="summary-row">
                    <span>Items ({cartCount})</span>
                    <span>{formatPrice(cartSubtotal)}</span>
                  </div>

                  <div className="summary-row">
                    <span>Shipping</span>
                    <span>Calculated at checkout</span>
                  </div>

                  <div className="summary-divider" />

                  <div className="summary-row summary-total">
                    <span>Subtotal</span>
                    <span>{formatPrice(cartSubtotal)}</span>
                  </div>

                  <p className="cart-note">
                    Taxes and shipping, if applicable, are not included.
                    Checkout will be implemented separately.
                  </p>

                  <button
                    type="button"
                    className="add-to-cart-button"
                    disabled
                  >
                    Proceed to Checkout — Coming Soon
                  </button>
                </aside>
              </div>
            )}
          </section>
        ) : selectedProductId !== null ? (
          <section className="product-detail-page">
            <button
              type="button"
              className="back-button"
              onClick={returnToCatalogue}
            >
              ← Back to products
            </button>

            {detailLoading && (
              <p className="message" role="status">
                Loading product details...
              </p>
            )}

            {detailError && (
              <div className="message error" role="alert">
                <p>{detailError}</p>
                <button
                  type="button"
                  className="reset-button"
                  onClick={returnToCatalogue}
                >
                  Back to products
                </button>
              </div>
            )}

            {!detailLoading && selectedProduct && (
              <article className="product-detail-card">
                <div className="product-detail-image">
                  {selectedProduct.image_url ? (
                    <img
                      src={selectedProduct.image_url}
                      alt={selectedProduct.name}
                    />
                  ) : (
                    <span>Product image coming soon</span>
                  )}
                </div>

                <div className="product-detail-info">
                  <p className="category">{selectedProduct.category}</p>
                  <h1>{selectedProduct.name}</h1>
                  <p className="detail-price">
                    {formatPrice(selectedProduct.price)}
                  </p>

                  <div className="detail-divider" />

                  <h2>Product description</h2>
                  <p className="detail-description">
                    {selectedProduct.description}
                  </p>

                  <div className="detail-stock">
                    <span
                      className={
                        selectedProduct.stock > 0
                          ? "stock available"
                          : "stock unavailable"
                      }
                    >
                      {selectedProduct.stock > 0
                        ? "In stock"
                        : "Out of stock"}
                    </span>

                    {selectedProduct.stock > 0 && (
                      <span>
                        {selectedProduct.stock} available
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    className="add-to-cart-button"
                    disabled={selectedProduct.stock < 1}
                    onClick={() => addToCart(selectedProduct)}
                  >
                    {selectedProduct.stock > 0
                      ? "Add to Cart"
                      : "Out of Stock"}
                  </button>

                  {cartMessage && (
                    <p className="cart-message" role="status">
                      {cartMessage}
                    </p>
                  )}

                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setShowCart(true);
                      setSelectedProductId(null);
                      setCartMessage("");
                    }}
                  >
                    View Cart ({cartCount})
                  </button>
                </div>
              </article>
            )}
          </section>
        ) : (
          <>
            <section className="hero">
              <p className="eyebrow">DISCOVER SOMETHING NEW</p>
              <h1>Find your next favourite.</h1>
              <p>Explore our collection of everyday essentials.</p>
            </section>

            <section className="catalog">
              <div className="catalog-heading">
                <div>
                  <h2>Our Products</h2>
                  <p>Thoughtfully selected for you</p>
                </div>

                <span className="product-count">
                  {loading
                    ? "Loading..."
                    : `${sortedProducts.length} products`}
                </span>
              </div>

              <div className="product-controls">
                <div className="search-box">
                  <label htmlFor="product-search">
                    Search products
                  </label>
                  <input
                    id="product-search"
                    type="search"
                    placeholder="Try headphones or backpack..."
                    value={searchTerm}
                    onChange={(event) =>
                      setSearchTerm(event.target.value)
                    }
                  />
                </div>

                <div className="category-box">
                  <label htmlFor="category-filter">Category</label>
                  <select
                    id="category-filter"
                    value={selectedCategory}
                    onChange={(event) =>
                      setSelectedCategory(event.target.value)
                    }
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category === "All"
                          ? "All categories"
                          : category}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sort-box">
                  <label htmlFor="product-sort">Sort by</label>
                  <select
                    id="product-sort"
                    value={sortOrder}
                    onChange={(event) =>
                      setSortOrder(event.target.value)
                    }
                  >
                    <option value="newest">Newest first</option>
                    <option value="price-low">Price: low to high</option>
                    <option value="price-high">Price: high to low</option>
                    <option value="name">Name: A to Z</option>
                  </select>
                </div>
              </div>

              {loading && (
                <p className="message">Loading products...</p>
              )}

              {error && (
                <p className="message error">{error}</p>
              )}

              {!loading && !error && sortedProducts.length === 0 && (
                <div className="message empty-state">
                  <h3>No products found</h3>
                  <p>
                    Try another search or select a different category.
                  </p>
                  <button
                    type="button"
                    className="reset-button"
                    onClick={() => {
                      setSearchTerm("");
                      setSelectedCategory("All");
                      setSortOrder("newest");
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}

              {!loading && !error && sortedProducts.length > 0 && (
                <div className="product-grid">
                  {sortedProducts.map((product) => (
                    <article
                      className="product-card"
                      key={product.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`View details for ${product.name}`}
                      onClick={() => openProduct(product.id)}
                      onKeyDown={(event) =>
                        handleProductCardKeyDown(event, product.id)
                      }
                    >
                      <div className="product-placeholder">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} />
                        ) : (
                          <span>Product</span>
                        )}
                      </div>

                      <div className="product-info">
                        <p className="category">{product.category}</p>
                        <h3>{product.name}</h3>
                        <p className="description">
                          {product.description}
                        </p>

                        <div className="product-footer">
                          <span className="price">
                            {formatPrice(product.price)}
                          </span>

                          <span
                            className={
                              product.stock > 0
                                ? "stock available"
                                : "stock unavailable"
                            }
                          >
                            {product.stock > 0
                              ? "In stock"
                              : "Out of stock"}
                          </span>
                        </div>

                        <span className="view-details-label">
                          View product details →
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <footer className="site-footer">
        ShopSphere · Built as a full-stack learning project
      </footer>
    </div>
  );
}

export default App;

