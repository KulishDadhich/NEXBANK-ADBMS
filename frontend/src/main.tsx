import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRight,
  Landmark,
  LayoutDashboard,
  Wallet,
  Send,
  History,
  Users,
  FileText,
  Settings,
  FlaskConical,
  ShieldCheck,
  LogOut,
  Sun,
  Moon,
  Menu,
  Plus,
  Check,
  Copy,
  ChevronRight,
  Activity,
  Database,
} from "lucide-react";
import { api, setToken, refresh, errorText, money } from "./api";
import "./styles.css";
type User = {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: string;
};
type Account = {
  id: string;
  account_number: string;
  balance: string;
  account_type: string;
  status: string;
};
const Auth = createContext<{
  user: User | null;
  reload: () => Promise<void>;
  logout: () => Promise<void>;
}>({ user: null, reload: async () => {}, logout: async () => {} });
const Notify = createContext<(s: string) => void>(() => {});
function useData<T>(path: string, initial: T) {
  const [data, setData] = useState<T>(initial),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const load = async () => {
    setRevision((r) => r + 1);
  };
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setLoading(true);
    api
      .get(path, { signal: controller.signal })
      .then((r) => {
        if (!controller.signal.aborted) setData(r.data);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorText(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, revision]);
  return { data, loading, error, load };
}
function Status({
  loading,
  error,
  empty = false,
}: {
  loading: boolean;
  error: string;
  empty?: boolean;
}) {
  return error ? (
    <div className="notice error" role="alert">
      {error}
    </div>
  ) : loading ? (
    <div className="skeleton" aria-label="Loading data" />
  ) : empty ? (
    <div className="empty">
      Nothing here yet. Your activity will appear here.
    </div>
  ) : null;
}
function Button({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className={"button " + (props.className || "")}>
      {children}
    </button>
  );
}
function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <span className="eyebrow">{eyebrow || "YOUR BANKING, SIMPLIFIED"}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function App() {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [toast, setToast] = useState("");
  const reload = async () => setUser((await api.get("/me")).data);
  const logout = async () => {
    await api.post("/auth/logout");
    setToken("");
    setUser(null);
  };
  useEffect(() => {
    refresh()
      .then(reload)
      .catch(() => setUser(null))
      .finally(() => setReady(true));
    const expired = () => setUser(null);
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, []);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(id);
    }
  }, [toast]);
  if (!ready)
    return (
      <div className="initial">
        <Landmark />
        <p>Opening NEXBANK…</p>
      </div>
    );
  return (
    <Auth.Provider value={{ user, reload, logout }}>
      <Notify.Provider value={setToast}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            path="/login"
            element={user ? <Navigate to="/app" /> : <AuthPage />}
          />
          <Route
            path="/register"
            element={user ? <Navigate to="/app" /> : <AuthPage register />}
          />
          <Route
            path="/app"
            element={user ? <Shell /> : <Navigate to="/login" replace />}
          >
            <Route index element={<Dashboard />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="accounts/:id" element={<AccountDetail />} />
            <Route path="transfer" element={<Transfer />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="beneficiaries" element={<Beneficiaries />} />
            <Route path="statements" element={<Statements />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="admin/transactions" element={<Transactions admin />} />
            <Route path="lab" element={<Laboratory />} />
          </Route>
          <Route
            path="*"
            element={
              <div className="initial">
                <h1>Page not found</h1>
                <Link to="/app">Return to dashboard</Link>
              </div>
            }
          />
        </Routes>
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </Notify.Provider>
    </Auth.Provider>
  );
}
function Brand() {
  return (
    <Link className="brand" to="/">
      <span>
        <Landmark size={23} />
      </span>
      NEXBANK<span className="brand-dot">.</span>
    </Link>
  );
}
function Landing() {
  const { user } = useContext(Auth);
  return (
    <div className="landing">
      <header>
        <Brand />
        <div>
          <Link to="/login">Sign in</Link>
          <Link className="button" to={user ? "/app" : "/register"}>
            {user ? "Open dashboard" : "Get started"} <ArrowUpRight size={17} />
          </Link>
        </div>
      </header>
      <section className="hero">
        <div>
          <span className="pill">THE EDUCATIONAL BANKING PLATFORM</span>
          <h1>
            Banking you can
            <br />
            <em>understand.</em>
          </h1>
          <p>
            Move simulated money. Follow every transaction. Discover the
            database engineering that keeps it all in balance.
          </p>
          <Link className="button" to="/register">
            Create your account <ArrowRight size={18} />
          </Link>
          <div className="hero-foot">
            <ShieldCheck size={18} /> Secure transactions. Reliable banking.
            Intelligent management.
          </div>
        </div>
        <div className="hero-art">
          <div className="orbit" />
          <div className="hero-card">
            <Landmark />
            <span>THE NEXBANK EXPERIENCE</span>
            <h2>
              Every movement.
              <br />
              Accounted for.
            </h2>
            <div className="card-line" />
            <p>ONE TRANSFER · TWO LEDGER ENTRIES</p>
            <div className="ledger-preview">
              <span>Debit ↗</span>
              <span>Credit ↙</span>
            </div>
          </div>
          <div className="float-tag">
            <Check size={20} /> Balanced by design
          </div>
        </div>
      </section>
      <section className="feature-grid">
        {[
          [
            ShieldCheck,
            "Confidence in every transfer",
            "Atomic transactions, row locks and an immutable ledger.",
          ],
          [
            Activity,
            "Clarity at a glance",
            "Accounts, statements and activity in one thoughtful workspace.",
          ],
          [
            Database,
            "Go beneath the surface",
            "Explore real database concepts in an isolated laboratory.",
          ],
        ].map(([Icon, title, desc]: any) => (
          <article key={title}>
            <Icon />
            <h3>{title}</h3>
            <p>{desc}</p>
          </article>
        ))}
      </section>
      <footer>
        Educational simulation only. No real money or banking credentials.
      </footer>
    </div>
  );
}
export const authSchema = z.object({
  fullName: z.string().optional(),
  email: z.email("Enter a valid email"),
  password: z.string().min(12, "Use at least 12 characters"),
});
export function AuthPage({ register = false }: { register?: boolean }) {
  const { reload } = useContext(Auth),
    navigate = useNavigate();
  const [error, setError] = useState("");
  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof authSchema>>({
    resolver: zodResolver(authSchema),
  });
  const submit = handleSubmit(async (data) => {
    setError("");
    try {
      if (register && (!data.fullName || data.fullName.trim().length < 2))
        throw Error("Enter your full name");
      const r = await api.post(
        register ? "/auth/register" : "/auth/login",
        data,
      );
      setToken(r.data.accessToken);
      await reload();
      navigate("/app");
    } catch (e) {
      setError(errorText(e));
    }
  });
  return (
    <div className="auth-page">
      <aside>
        <Brand />
        <div>
          <span className="eyebrow">
            BUILT ON TRUST. DESIGNED FOR LEARNING.
          </span>
          <h1>
            Your next chapter
            <br />
            starts here.
          </h1>
          <p>
            A clear view of your money.
            <br />A deeper understanding of your database.
          </p>
        </div>
        <small>NEXBANK · Educational banking simulation</small>
      </aside>
      <main>
        <Link to="/" className="back-link">
          ← Back to home
        </Link>
        <div className="auth-form">
          <span className="icon-tile">
            <ShieldCheck />
          </span>
          <h1>{register ? "Make yourself at home." : "Welcome back."}</h1>
          <p>
            {register
              ? "Create your simulated banking account."
              : "Sign in to your NEXBANK workspace."}
          </p>
          <form onSubmit={submit}>
            {register && (
              <label>
                Full name
                <input autoComplete="name" {...field("fullName")} required />
              </label>
            )}
            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                {...field("email")}
              />
              <small className="field-error">{errors.email?.message}</small>
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                {...field("password")}
              />
              <small className="field-error">{errors.password?.message}</small>
            </label>
            {error && (
              <div role="alert" className="notice error">
                {error}
              </div>
            )}
            <Button disabled={isSubmitting}>
              {isSubmitting
                ? "Please wait…"
                : register
                  ? "Create account"
                  : "Sign in"}
              <ArrowRight size={17} />
            </Button>
          </form>
          <p>
            {register ? "Already have an account?" : "New to NEXBANK?"}{" "}
            <Link to={register ? "/login" : "/register"}>
              {register ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <small className="muted">
            Use a unique password. Never enter real banking credentials.
          </small>
        </div>
      </main>
    </div>
  );
}
const links = [
  ["", "Overview", LayoutDashboard],
  ["accounts", "My accounts", Wallet],
  ["transfer", "Transfer money", Send],
  ["transactions", "Transactions", History],
  ["beneficiaries", "Beneficiaries", Users],
  ["statements", "Statements", FileText],
] as const;
function Shell() {
  const { user, logout } = useContext(Auth),
    notify = useContext(Notify);
  const [open, setOpen] = useState(false),
    [dark, setDark] = useState(
      localStorage.getItem("nexbank-theme") === "dark",
    );
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("nexbank-theme", dark ? "dark" : "light");
  }, [dark]);
  return (
    <div className="shell">
      <aside className={"sidebar " + (open ? "open" : "")}>
        <Brand />
        <span className="nav-label">WORKSPACE</span>
        <nav>
          {links.map(([path, label, Icon]) => (
            <NavLink
              key={path}
              end
              to={"/app" + (path ? "/" + path : "")}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
          {user?.role === "ADMIN" && (
            <>
              <span className="nav-label">ADMINISTRATION</span>
              <NavLink to="/app/admin" end>
                <ShieldCheck size={19} />
                Administration
              </NavLink>
              <NavLink to="/app/admin/transactions">
                <Activity size={19} />
                Monitoring
              </NavLink>
              <NavLink to="/app/lab">
                <FlaskConical size={19} />
                Database laboratory
              </NavLink>
            </>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="simulation">
            <span className="green-dot" /> Simulation environment
            <p>
              Learn with confidence.
              <br />
              No real money involved.
            </p>
          </div>
          <NavLink to="/app/settings">
            <Settings size={19} />
            Settings
          </NavLink>
          <button onClick={() => logout().catch((e) => notify(errorText(e)))}>
            <LogOut size={19} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Toggle navigation"
            onClick={() => setOpen(!open)}
          >
            <Menu />
          </button>
          <span>
            NEXBANK <ChevronRight size={14} /> Personal workspace
          </span>
          <div>
            <span className="environment">
              <span className="green-dot" />
              Educational simulation
            </span>
            <button
              className="icon-button"
              aria-label="Toggle theme"
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <Link className="avatar" to="/app/settings">
              {user?.full_name.slice(0, 1)}
            </Link>
          </div>
        </header>
        <main className="content">
          <OutletProxy />
        </main>
        <footer className="workspace-footer">
          NEXBANK · Secure Transactions. Reliable Banking. Intelligent
          Management.<span>Educational use only</span>
        </footer>
      </div>
    </div>
  );
}
// Nested routes render via the router outlet.
import { Outlet } from "react-router-dom";
function OutletProxy() {
  return <Outlet />;
}
function Stat({
  label,
  value,
  icon: Icon,
  note,
}: {
  label: string;
  value: string;
  icon: any;
  note: string;
}) {
  return (
    <article className="stat">
      <div>
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <h2>{value}</h2>
      <small>{note}</small>
    </article>
  );
}
export function Dashboard() {
  const { user } = useContext(Auth);
  const accounts = useData<Account[]>("/accounts", []),
    analytics = useData<any[]>("/analytics", []),
    history = useData<any>("/transactions", { items: [] });
  const total = accounts.data.reduce((s, a) => s + BigInt(a.balance), 0n),
    month = new Date().toISOString().slice(0, 7),
    current = analytics.data.find((a) => a.month === month);
  const chart = analytics.data.map((d) => ({
    ...d,
    incoming: Number(d.incoming) / 100,
    outgoing: Number(d.outgoing) / 100,
  }));
  return (
    <>
      <PageTitle
        title={`Good to see you, ${user?.full_name.split(" ")[0]}.`}
        description="Here's what's happening with your accounts today."
        action={
          <Link className="button" to="/app/transfer">
            <Plus size={17} />
            Make a transfer
          </Link>
        }
      />
      <Status loading={accounts.loading} error={accounts.error} />
      <div className="stats">
        <Stat
          label="Total balance"
          value={money(total)}
          icon={Wallet}
          note={`${accounts.data.length} simulated accounts · INR`}
        />
        <Stat
          label="Money in"
          value={money(current?.incoming || "0")}
          icon={ArrowDownLeft}
          note="Current month · UTC"
        />
        <Stat
          label="Money out"
          value={money(current?.outgoing || "0")}
          icon={ArrowUpRight}
          note="Current month · UTC"
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Cash flow</h2>
              <p>Your monthly account movements</p>
            </div>
            <span className="pill neutral">All time</span>
          </div>
          <Status
            loading={analytics.loading}
            error={analytics.error}
            empty={!chart.length}
          />
          {chart.length > 0 && (
            <div className="chart">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chart}>
                  <defs>
                    <linearGradient id="flow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5272ef" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#5272ef" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 6" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Area
                    name="Incoming INR"
                    dataKey="incoming"
                    stroke="#5272ef"
                    strokeWidth={3}
                    fill="url(#flow)"
                  />
                  <Area
                    name="Outgoing INR"
                    dataKey="outgoing"
                    stroke="#d99a4b"
                    fill="transparent"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="chart-legend">
            <span>● Incoming</span>
            <span>● Outgoing</span>
          </div>
        </section>
        <section className="panel accounts-panel">
          <div className="section-head">
            <h2>Your accounts</h2>
            <Link to="/app/accounts">
              View all <ArrowUpRight size={15} />
            </Link>
          </div>
          {accounts.data.slice(0, 2).map((a) => (
            <Link key={a.id} className="bank-card" to={"/app/accounts/" + a.id}>
              <div>
                <Landmark size={20} />
                <span>{a.account_type}</span>
              </div>
              <small>AVAILABLE BALANCE</small>
              <h2>{money(a.balance)}</h2>
              <div>
                <span>•••• {a.account_number.slice(-4)}</span>
                <span>INR</span>
              </div>
            </Link>
          ))}
          {!accounts.data.length && !accounts.loading && (
            <div className="empty">
              Your first account is one click away.
              <Link className="button" to="/app/accounts">
                Open an account
              </Link>
            </div>
          )}
        </section>
      </div>
      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Recent transactions</h2>
            <p>A clear trail of every movement</p>
          </div>
          <Link to="/app/transactions">
            View all <ArrowRight size={15} />
          </Link>
        </div>
        <Status
          loading={history.loading}
          error={history.error}
          empty={!history.data.items.length}
        />
        <TransactionTable items={history.data.items.slice(0, 5)} />
      </section>
      <div className="trust-banner">
        <ShieldCheck />
        <div>
          <strong>Every transfer has a story. Every entry has a match.</strong>
          <p>
            NEXBANK records balanced ledger entries within a single database
            transaction.
          </p>
        </div>
        <span className="pill neutral">ACID by design</span>
      </div>
    </>
  );
}
function Accounts() {
  const accounts = useData<Account[]>("/accounts", []),
    notify = useContext(Notify);
  const [type, setType] = useState("SAVINGS"),
    [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true);
    try {
      await api.post("/accounts", { type });
      notify("Your new account is ready. It starts with a zero balance.");
      await accounts.load();
    } catch (e) {
      notify(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title="Your accounts."
        description="A separate space for every purpose. Up to five accounts."
      />
      <section className="panel inline-form">
        <label>
          Account type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option>SAVINGS</option>
            <option>CURRENT</option>
          </select>
        </label>
        <Button onClick={create} disabled={busy}>
          <Plus size={17} />
          Open account
        </Button>
      </section>
      <Status loading={accounts.loading} error={accounts.error} />
      <div className="account-grid">
        {accounts.data.map((a) => (
          <Link className="bank-card" key={a.id} to={"/app/accounts/" + a.id}>
            <div>
              <Landmark />
              <span>{a.status}</span>
            </div>
            <small>{a.account_type} ACCOUNT</small>
            <h2>{money(a.balance)}</h2>
            <div>
              <span>{a.account_number}</span>
              <ArrowUpRight size={19} />
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
function AccountDetail() {
  const { id } = useParams(),
    d = useData<any>("/accounts/" + id, { account: null, entries: [] }),
    notify = useContext(Notify);
  return (
    <>
      <PageTitle
        title="Account details."
        description="Your balance and its immutable ledger entries."
      />
      <Status loading={d.loading} error={d.error} />
      {d.data.account && (
        <section className="panel">
          <h2>{d.data.account.account_number}</h2>
          <h1>{money(d.data.account.balance)}</h1>
          <p>
            {d.data.account.account_type} · {d.data.account.status}
          </p>
          <Button
            className="secondary"
            onClick={() =>
              navigator.clipboard
                .writeText(d.data.account.account_number)
                .then(() => notify("Account number copied"))
            }
          >
            <Copy size={16} />
            Copy account number
          </Button>
        </section>
      )}
      <section className="panel">
        <h2>Ledger activity</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Description</th>
                <th>UTC date</th>
                <th>Movement</th>
              </tr>
            </thead>
            <tbody>
              {d.data.entries.map((e: any) => (
                <tr key={e.id}>
                  <td>{e.reference_number}</td>
                  <td>{e.description}</td>
                  <td>{new Date(e.created_at).toLocaleString()}</td>
                  <td>{money(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
export function validateTransfer(amount: string) {
  if (!/^(0|[1-9]\d{0,10})(\.\d{1,2})?$/.test(amount)) return false;
  const [whole, fraction = ""] = amount.split(".");
  const paise = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return paise > 0n && paise <= 1000000000000n;
}
function Transfer() {
  const accounts = useData<Account[]>("/accounts", []),
    beneficiaries = useData<any[]>("/beneficiaries", []);
  const [form, setForm] = useState({
      senderId: "",
      recipient: "",
      amount: "",
      description: "",
    }),
    [review, setReview] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<any>(null),
    [key, setKey] = useState(crypto.randomUUID());
  const set = (name: string, value: string) => {
    setForm({ ...form, [name]: value });
    setKey(crypto.randomUUID());
    setReview(false);
  };
  async function send() {
    setBusy(true);
    setError("");
    try {
      setResult(
        (
          await api.post("/transfers", form, {
            headers: { "Idempotency-Key": key },
          })
        ).data,
      );
      await accounts.load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title="Make a transfer."
        description="Move simulated funds with confidence. Every transfer is atomic."
      />
      <div className="two-columns">
        <section className="panel">
          {result ? (
            <div className="success-state">
              <span className="success-icon">
                <Check />
              </span>
              <h2>Transfer complete.</h2>
              <h1>{money(result.amount)}</h1>
              <p>Your reference</p>
              <code>{result.reference}</code>
              <Button
                onClick={() => {
                  setResult(null);
                  setReview(false);
                  setKey(crypto.randomUUID());
                  setForm({ ...form, amount: "", description: "" });
                }}
              >
                Make another transfer
              </Button>
            </div>
          ) : (
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (!validateTransfer(form.amount)) {
                  setError("Enter a positive amount with up to two decimals");
                  return;
                }
                setError("");
                setReview(true);
              }}
            >
              <h2>{review ? "Review your transfer" : "Transfer details"}</h2>
              <Status loading={accounts.loading} error={accounts.error} />
              <label>
                From account
                <select
                  required
                  disabled={review}
                  value={form.senderId}
                  onChange={(e) => set("senderId", e.target.value)}
                >
                  <option value="">Choose an account</option>
                  {accounts.data
                    .filter((a) => a.status === "ACTIVE")
                    .map((a) => (
                      <option value={a.id} key={a.id}>
                        {a.account_number} · {money(a.balance)}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Recipient account number
                <input
                  required
                  disabled={review}
                  pattern="NX[0-9]{16}"
                  placeholder="NX followed by 16 digits"
                  value={form.recipient}
                  onChange={(e) => set("recipient", e.target.value)}
                  list="saved-beneficiaries"
                />
                <datalist id="saved-beneficiaries">
                  {beneficiaries.data.map((b) => (
                    <option key={b.id} value={b.account_number}>
                      {b.nickname}
                    </option>
                  ))}
                </datalist>
              </label>
              <label>
                Amount (INR)
                <input
                  required
                  disabled={review}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => set("amount", e.target.value)}
                />
              </label>
              <label>
                Note (optional)
                <input
                  maxLength={255}
                  disabled={review}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="What's this transfer for?"
                />
              </label>
              {error && (
                <div className="notice error" role="alert">
                  {error}
                </div>
              )}
              {review ? (
                <div className="actions">
                  <Button
                    type="button"
                    disabled={busy}
                    className="secondary"
                    onClick={() => setReview(false)}
                  >
                    Edit
                  </Button>
                  <Button type="button" disabled={busy} onClick={send}>
                    {busy ? "Processing…" : "Confirm transfer"}
                    <ArrowRight size={17} />
                  </Button>
                </div>
              ) : (
                <Button type="submit">
                  Review transfer
                  <ArrowRight size={17} />
                </Button>
              )}
            </form>
          )}
        </section>
        <aside className="panel guidance">
          <span className="icon-tile">
            <ShieldCheck />
          </span>
          <h2>Safe by design.</h2>
          <p>Before confirmation, double-check the recipient and amount.</p>
          <ul>
            <li>The source account must belong to you.</li>
            <li>Both accounts must be active.</li>
            <li>If any posting fails, all changes roll back.</li>
            <li>Retrying the same request cannot debit twice.</li>
          </ul>
          <div className="notice">
            Simulation only. Transfers move no real money.
          </div>
        </aside>
      </div>
    </>
  );
}
function TransactionDialog({
  transaction: t,
  close,
}: {
  transaction: any;
  close: () => void;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={close}
      className="transaction-dialog"
      aria-label="Transaction details"
    >
      <div className="section-head">
        <h2>Transaction details</h2>
        <Button className="secondary" onClick={close}>
          Close
        </Button>
      </div>
      <h1>{money(t.amount)}</h1>
      <dl>
        <dt>Reference</dt>
        <dd>{t.reference_number}</dd>
        <dt>Sender</dt>
        <dd>{t.sender_number}</dd>
        <dt>Recipient</dt>
        <dd>{t.receiver_number}</dd>
        <dt>UTC timestamp</dt>
        <dd>{new Date(t.created_at).toISOString()}</dd>
        <dt>Status</dt>
        <dd>{t.status}</dd>
        <dt>Note</dt>
        <dd>{t.description || "No note added"}</dd>
      </dl>
    </dialog>
  );
}
function TransactionTable({ items }: { items: any[] }) {
  const { user } = useContext(Auth);
  const [selected, setSelected] = useState<any>(null);
  return (
    <div className="table-wrap">
      {selected && (
        <TransactionDialog
          transaction={selected}
          close={() => setSelected(null)}
        />
      )}
      <table>
        <thead>
          <tr>
            <th>Transaction</th>
            <th>Account</th>
            <th>Date</th>
            <th>Status</th>
            <th className="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => {
            const outgoing = t.sender_user_id === user?.id;
            return (
              <tr key={t.id}>
                <td>
                  <div className="transaction-cell">
                    <span
                      className={"tx-icon " + (!outgoing ? "incoming" : "")}
                    >
                      {outgoing ? (
                        <ArrowUpRight size={18} />
                      ) : (
                        <ArrowDownLeft size={18} />
                      )}
                    </span>
                    <div>
                      <button
                        className="detail-link"
                        onClick={() => setSelected(t)}
                      >
                        {t.description || t.transaction_type}
                      </button>
                      <small title={t.reference_number}>
                        {t.reference_number}
                      </small>
                    </div>
                  </div>
                </td>
                <td>
                  ••••{" "}
                  {String(outgoing ? t.receiver_number : t.sender_number).slice(
                    -4,
                  )}
                </td>
                <td>
                  {new Date(t.created_at).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td>
                  <span className="badge">Completed</span>
                </td>
                <td className={"right " + (!outgoing ? "positive" : "")}>
                  {outgoing ? "−" : "+"}
                  {money(t.amount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
export function Transactions({ admin = false }: { admin?: boolean }) {
  const { user } = useContext(Auth);
  const [search, setSearch] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [page, setPage] = useState(1),
    [sort, setSort] = useState("desc");
  const q = new URLSearchParams({ search, from, to, page: String(page), sort });
  const d = useData<any>(
    (admin ? "/admin/transactions" : "/transactions") + "?" + q,
    { items: [], pages: 0, total: 0 },
  );
  if (admin && user?.role !== "ADMIN") return <Navigate to="/app" />;
  return (
    <>
      <PageTitle
        title={admin ? "Transaction monitoring." : "Your transaction history."}
        description="Search references and notes, or explore a date range."
      />
      <section className="panel">
        <div className="filters">
          <label>
            Search
            <input
              placeholder="Reference or description"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            From
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Order
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </label>
        </div>
        <Status
          loading={d.loading}
          error={d.error}
          empty={!d.data.items.length}
        />
        <TransactionTable items={d.data.items} />
        <div className="pagination">
          <span>{d.data.total} completed transactions</span>
          <div>
            <Button
              className="secondary"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span>Page {page}</span>
            <Button
              className="secondary"
              disabled={page >= d.data.pages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </section>
      {admin && <FailedAttempts />}
    </>
  );
}
function FailedAttempts() {
  const [search, setSearch] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [page, setPage] = useState(1);
  const q = new URLSearchParams({ search, from, to, page: String(page) });
  const d = useData<any>("/admin/failures?" + q, {
    items: [],
    total: 0,
    pages: 0,
  });
  return (
    <section className="panel">
      <h2>Failed transfers</h2>
      <p>Rejected operations have no posted ledger entries.</p>
      <div className="filters">
        <label>
          Reason or actor
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Failed from
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Failed to
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>
      <Status
        loading={d.loading}
        error={d.error}
        empty={!d.data.items.length}
      />
      {d.data.items.map((r: any) => (
        <details key={r.id}>
          <summary>
            {r.reason} · {new Date(r.created_at).toLocaleString()}
          </summary>
          <pre>{JSON.stringify(r, null, 2)}</pre>
        </details>
      ))}
      <div className="pagination">
        <span>{d.data.total} failed attempts</span>
        <div>
          <Button
            className="secondary"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous failures
          </Button>
          <Button
            className="secondary"
            disabled={page >= d.data.pages}
            onClick={() => setPage(page + 1)}
          >
            Next failures
          </Button>
        </div>
      </div>
    </section>
  );
}
function Beneficiaries() {
  const d = useData<any[]>("/beneficiaries", []),
    notify = useContext(Notify);
  const [number, setNumber] = useState(""),
    [nickname, setNickname] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) await api.patch("/beneficiaries/" + editing, { nickname });
      else
        await api.post("/beneficiaries", { accountNumber: number, nickname });
      setEditing("");
      setNumber("");
      setNickname("");
      await d.load();
      notify("Beneficiary saved");
    } catch (e) {
      notify(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title="People you bank with."
        description="Save account numbers for your next transfer."
      />
      <form className="panel inline-form" onSubmit={submit}>
        <label>
          Nickname
          <input
            required
            maxLength={80}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
        </label>
        <label>
          Account number
          <input
            required
            disabled={!!editing}
            pattern="NX[0-9]{16}"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
        </label>
        <Button disabled={busy}>
          {editing ? "Save changes" : "Add beneficiary"}
        </Button>
        {editing && (
          <Button
            type="button"
            className="secondary"
            onClick={() => {
              setEditing("");
              setNumber("");
              setNickname("");
            }}
          >
            Cancel
          </Button>
        )}
      </form>
      <Status loading={d.loading} error={d.error} empty={!d.data.length} />
      <div className="account-grid">
        {d.data.map((b) => (
          <article className="panel" key={b.id}>
            <span className="icon-tile">
              <Users />
            </span>
            <h2>{b.nickname}</h2>
            <p>{b.account_number}</p>
            <div className="actions">
              <Button
                className="secondary"
                onClick={() => {
                  setEditing(b.id);
                  setNickname(b.nickname);
                  setNumber(b.account_number);
                }}
              >
                Edit
              </Button>
              <Button
                className="secondary"
                onClick={async () => {
                  if (window.confirm("Remove this beneficiary?"))
                    try {
                      await api.delete("/beneficiaries/" + b.id);
                      await d.load();
                    } catch (e) {
                      notify(errorText(e));
                    }
                }}
              >
                Remove
              </Button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
function Statements() {
  const d = useData<Account[]>("/accounts", []),
    notify = useContext(Notify);
  async function download(id: string) {
    try {
      const r = await api.get("/accounts/" + id + "/statement", {
          responseType: "blob",
        }),
        url = URL.createObjectURL(r.data),
        a = document.createElement("a");
      a.href = url;
      a.download = "nexbank-statement.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      notify(errorText(e));
    }
  }
  return (
    <>
      <PageTitle
        title="Your records, ready."
        description="Download a complete CSV statement. Amounts are exact integer paise."
      />
      <Status loading={d.loading} error={d.error} empty={!d.data.length} />
      {d.data.map((a) => (
        <div className="panel statement-row" key={a.id}>
          <FileText />
          <div>
            <h2>{a.account_number}</h2>
            <p>{a.account_type} · Full transaction history</p>
          </div>
          <Button className="secondary" onClick={() => download(a.id)}>
            Download CSV <ArrowDownLeft size={17} />
          </Button>
        </div>
      ))}
    </>
  );
}
function SettingsPage() {
  const { user, reload } = useContext(Auth),
    notify = useContext(Notify);
  const [name, setName] = useState(user?.full_name || ""),
    [phone, setPhone] = useState(user?.phone || ""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <PageTitle
        title="Make it yours."
        description="Manage your profile and workspace preferences."
      />
      <form
        className="panel narrow"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api.patch("/me", { fullName: name, phone });
            await reload();
            notify("Profile updated");
          } catch (e) {
            notify(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Full name
          <input
            required
            minLength={2}
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Email
          <input disabled value={user?.email} />
        </label>
        <label>
          Phone (optional)
          <input
            maxLength={30}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <Button disabled={busy}>Save profile</Button>
        <p className="muted">
          Use the sun/moon control in the top bar to change your theme.
        </p>
      </form>
    </>
  );
}
function JsonPanel({ title, path }: { title: string; path: string }) {
  const d = useData<any>(path, null);
  return (
    <section className="panel">
      <div className="section-head">
        <h2>{title}</h2>
        <Button className="secondary" onClick={d.load}>
          Refresh
        </Button>
      </div>
      <Status loading={d.loading} error={d.error} />
      <pre>{JSON.stringify(d.data, null, 2)}</pre>
    </section>
  );
}
function AdminPage() {
  const { user } = useContext(Auth),
    notify = useContext(Notify);
  const d = useData<any>("/admin/overview", {}),
    users = useData<any[]>("/admin/users", []),
    accounts = useData<any[]>("/admin/accounts", []);
  const [grantKey, setGrantKey] = useState(crypto.randomUUID());
  const [grant, setGrant] = useState({ accountId: "", amount: "", reason: "" }),
    [busy, setBusy] = useState(false);
  if (user?.role !== "ADMIN") return <Navigate to="/app" />;
  return (
    <>
      <PageTitle
        eyebrow="ADMINISTRATION"
        title="The bigger picture."
        description="Monitor the simulation, manage access and inspect database integrity."
      />
      <Status loading={d.loading} error={d.error} />
      <div className="stats">
        <Stat
          label="Registered users"
          value={String(d.data.users || 0)}
          icon={Users}
          note={`${d.data.accounts || 0} accounts`}
        />
        <Stat
          label="Posted volume"
          value={money(d.data.volume || 0)}
          icon={Activity}
          note={`${d.data.completed || 0} completed transfers`}
        />
        <Stat
          label="Failed attempts"
          value={String(d.data.failed || 0)}
          icon={ShieldCheck}
          note="Rolled back or rejected"
        />
      </div>
      <section className="panel">
        <h2>User access</h2>
        <Status loading={users.loading} error={users.error} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.data.map((u) => (
                <tr key={u.id}>
                  <td>{u.full_name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.status}</td>
                  <td>
                    {u.role === "USER" && (
                      <Button
                        className="secondary"
                        onClick={async () => {
                          try {
                            await api.patch("/admin/users/" + u.id, {
                              status:
                                u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
                            });
                            await users.load();
                          } catch (e) {
                            notify(errorText(e));
                          }
                        }}
                      >
                        {u.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h2>Account controls</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Owner</th>
                <th>Account</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {accounts.data.map((a) => (
                <tr key={a.account_id}>
                  <td>{a.full_name}</td>
                  <td>{a.account_number}</td>
                  <td>{money(a.balance)}</td>
                  <td>{a.status}</td>
                  <td>
                    <Button
                      className="secondary"
                      onClick={async () => {
                        try {
                          await api.patch("/admin/accounts/" + a.account_id, {
                            status: a.status === "ACTIVE" ? "FROZEN" : "ACTIVE",
                          });
                          await accounts.load();
                        } catch (e) {
                          notify(errorText(e));
                        }
                      }}
                    >
                      {a.status === "ACTIVE" ? "Freeze" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!window.confirm("Issue this simulated grant from the treasury?"))
            return;
          setBusy(true);
          try {
            await api.post("/admin/adjustments", grant, {
              headers: { "Idempotency-Key": grantKey },
            });
            notify("Simulated grant posted");
            setGrantKey(crypto.randomUUID());
            setGrant({ ...grant, amount: "", reason: "" });
            await accounts.load();
            await d.load();
          } catch (e) {
            notify(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>Controlled simulated grant</h2>
        <p>Creates a matching treasury debit. No real funds are issued.</p>
        <div className="filters">
          <label>
            Recipient
            <select
              required
              value={grant.accountId}
              onChange={(e) => (
                setGrantKey(crypto.randomUUID()),
                setGrant({ ...grant, accountId: e.target.value })
              )}
            >
              <option value="">Choose account</option>
              {accounts.data.map((a) => (
                <option key={a.account_id} value={a.account_id}>
                  {a.full_name} · {a.account_number}
                </option>
              ))}
            </select>
          </label>
          <label>
            INR amount
            <input
              required
              value={grant.amount}
              onChange={(e) => (
                setGrantKey(crypto.randomUUID()),
                setGrant({ ...grant, amount: e.target.value })
              )}
            />
          </label>
          <label>
            Reason
            <input
              required
              minLength={10}
              maxLength={255}
              value={grant.reason}
              onChange={(e) => (
                setGrantKey(crypto.randomUUID()),
                setGrant({ ...grant, reason: e.target.value })
              )}
            />
          </label>
        </div>
        <Button disabled={busy}>Issue simulated grant</Button>
      </form>
      <JsonPanel title="Database integrity" path="/admin/database" />
      <JsonPanel title="Audit trail" path="/admin/audit" />
    </>
  );
}
function Laboratory() {
  const { user } = useContext(Auth);
  const d = useData<any>("/admin/lab", { enabled: false, experiments: [] });
  const [result, setResult] = useState<any>(null),
    [running, setRunning] = useState(""),
    [error, setError] = useState("");
  if (user?.role !== "ADMIN") return <Navigate to="/app" />;
  return (
    <>
      <PageTitle
        eyebrow="ADBMS LABORATORY"
        title="See the database at work."
        description="Real SQL. Separate sessions. Observable results."
      />
      <div className="notice">
        {d.data.enabled
          ? "Experiments run in a dedicated laboratory database and clean up their own tables."
          : "Execution is disabled on this server. Configure a separate local _lab database to run experiments safely."}
      </div>
      <Status loading={d.loading} error={d.error} />
      <div className="lab-grid">
        {d.data.experiments.map((e: any, i: number) => (
          <article className="panel" key={e.id}>
            <span className="eyebrow">
              EXPERIMENT {String(i + 1).padStart(2, "0")}
            </span>
            <h2>{e.name}</h2>
            <Button
              className="secondary"
              disabled={!d.data.enabled || !!running}
              onClick={async () => {
                setRunning(e.id);
                setError("");
                try {
                  setResult((await api.post("/admin/lab/" + e.id)).data);
                } catch (err) {
                  setError(errorText(err));
                } finally {
                  setRunning("");
                }
              }}
            >
              {running === e.id ? "Running…" : "Run experiment"}
              <ArrowRight size={16} />
            </Button>
          </article>
        ))}
      </div>
      {error && <div className="notice error">{error}</div>}
      {result && (
        <section className="panel">
          <h2>Observed evidence</h2>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </section>
      )}
    </>
  );
}
if (document.getElementById("root"))
  createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  );
