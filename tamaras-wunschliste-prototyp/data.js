(function () {
  const STORAGE_KEY = "tamaraWishlistData_v1";
  const BASKET_KEY = "tamaraWishlistBag_v1";
  const ADMIN_KEY = "tamaraWishlistAdmin_v1";
  const seed = [
    { id: "book-journal", name: "Notizbuch mit Leineneinband", category: "Buecher & Schreiben", price: 18, description: "Fuer Gedanken, Listen und kleine Ideen.", symbol: "BOOK", image: "", giftType: "small", audience: ["alle"], status: "available", link: "" },
    { id: "ceramic-mug", name: "Keramiktasse", category: "Zuhause", price: 12, description: "Eine schoene Tasse fuer Tee oder Kaffee.", symbol: "CUP", image: "", giftType: "small", audience: ["alle"], status: "available", link: "" },
    { id: "scented-candle", name: "Duftkerze", category: "Gemutliches", price: 24, description: "Ein warmer, holziger Duft waere schoen.", symbol: "CANDLE", image: "", giftType: "small", audience: ["familie", "freund", "schwester"], status: "available", link: "" },
    { id: "special-book", name: "Ein besonderes Buch", category: "Buecher", price: 18, description: "Ein Buch aus meiner aktuellen Leseliste.", symbol: "BOOKS", image: "", giftType: "small", audience: ["alle"], status: "available", link: "" },
    { id: "crossbody-bag", name: "Kleine Umhaengetasche", category: "Accessoires", price: 45, description: "Schlicht, dunkel und alltagstauglich.", symbol: "BAG", image: "", giftType: "large", audience: ["schwester", "familie", "freund"], status: "available", link: "" },
    { id: "headphones", name: "Kopfhoerer", category: "Technik", price: 120, description: "Ein groesserer Wunsch, fuer den mehrere zusammenlegen koennen.", symbol: "AUDIO", image: "", giftType: "group", audience: ["familie", "freund", "schwester"], status: "available", link: "" }
  ];

  function read(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.error("Lokaler Speicher ist nicht verfuegbar.", error);
      return fallback;
    }
  }
  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  let databaseWishes = null;

async function loadWishesFromSupabase() {
  const { data, error } = await window.wishlistSupabase
    .from("wishes")
    .select("*")
    .eq("status", "available")
    .order("created_at", { ascending: true });

  if (error) throw error;

  databaseWishes = data.map((row) => ({
    id: row.id,
    name: row.title,
    category: row.category || "Sonstiges",
    price: Number(row.price) || 0,
    description: row.description || "",
    symbol: "GIFT",
    image: row.image_url || "",
    giftType: row.gift_type || "small",
    audience: row.audience || [],
    status: row.status,
    link: row.shop_url || "",
  }));

  return databaseWishes;
}
  function getWishes() {
    if (databaseWishes !== null) return databaseWishes;
    const current = read(STORAGE_KEY, null);
    if (Array.isArray(current)) return current;
    write(STORAGE_KEY, seed);
    return seed.map(item => ({ ...item }));
  }
  function saveWishes(wishes) { write(STORAGE_KEY, wishes); }
  function getBag() { return read(BASKET_KEY, []); }
  function saveBag(ids) { write(BASKET_KEY, ids); }
  function getAdminPassword() { return localStorage.getItem(ADMIN_KEY) || ""; }
  function setAdminPassword(password) { localStorage.setItem(ADMIN_KEY, password); }
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }
  function money(value) {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(value) || 0);
  }
  window.WishlistData = { getWishes, saveWishes, getBag, saveBag, getAdminPassword, setAdminPassword, escapeHTML, money, loadWishesFromSupabase};
})();
