import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  App,
  Dashboard,
  Transactions,
  AuthPage,
  authSchema,
  validateTransfer,
} from "./main";
import { money, api, refresh } from "./api";
vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  api: { post: vi.fn(), get: vi.fn() },
  refresh: vi.fn(),
}));
afterEach(cleanup);
describe("authentication forms", () => {
  it("renders a labeled registration form", () => {
    render(
      <MemoryRouter>
        <AuthPage register />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText("Full name")).toBeVisible();
    expect(screen.getByLabelText("Email address")).toBeVisible();
    expect(
      screen.getByRole("button", { name: /create account/i }),
    ).toBeVisible();
  });
  it("shows validation errors before submitting", async () => {
    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "short" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText("Use at least 12 characters")).toBeVisible();
  });
  it("validates email and password independently", () => {
    expect(authSchema.safeParse({ email: "x", password: "123" }).success).toBe(
      false,
    );
  });
});
describe("transfer input", () => {
  it.each(["0", "-4", "1.001", "1e3", "abc"])("rejects %s", (value) =>
    expect(validateTransfer(value)).toBe(false),
  );
  it("accepts exact decimal amounts", () => {
    expect(validateTransfer("0.01")).toBe(true);
    expect(validateTransfer("12.50")).toBe(true);
  });
  it("formats without rounding large balances", () => {
    expect(money("100000000000000001")).toBe("₹1,00,00,00,00,00,00,000.01");
    expect(money("-1")).toBe("-₹0.01");
  });
});

describe("workspace behavior", () => {
  it("renders zero-balance dashboard with honest empty states", async () => {
    vi.mocked(api.get).mockImplementation(
      async (path: any) =>
        ({ data: path === "/transactions" ? { items: [] } : [] }) as any,
    );
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    expect((await screen.findAllByText("₹0.00")).length).toBe(3);
    expect(screen.getByText("Cash flow")).toBeVisible();
  });
  it("passes a transaction search to the API", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { items: [], pages: 0, total: 0 },
    });
    render(
      <MemoryRouter>
        <Transactions />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByPlaceholderText("Reference or description"), {
      target: { value: "rent" },
    });
    expect(
      vi
        .mocked(api.get)
        .mock.calls.some(([url]) => String(url).includes("search=rent")),
    ).toBe(true);
  });
  it("redirects protected navigation to login when refresh fails", async () => {
    vi.mocked(refresh).mockRejectedValue(new Error("No session"));
    render(
      <MemoryRouter initialEntries={["/app/accounts"]}>
        <App />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("heading", { name: "Welcome back." }),
    ).toBeVisible();
  });
});
