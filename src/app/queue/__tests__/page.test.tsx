import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

const mockSupabase = vi.hoisted(() => ({
  auth: {
    getUser: vi.fn(),
    signOut: vi.fn(),
  },
  from: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: mockSupabase,
}));

vi.mock("@/components/CopyEmailButton", () => ({
  default: ({
    email,
    label,
  }: {
    email?: string | null;
    label?: string;
  }) => {
    if (!email || !email.trim()) return null;
    return (
      <button
        type="button"
        aria-label={label ? `Copy email for ${label}` : `Copy email ${email}`}
        data-testid="copy-email-button"
      >
        Copy
      </button>
    );
  },
}));

import QueuePage from "../page";

describe("QueuePage smoke test", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });

  function mockAuthenticatedUser(email: string) {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { email } },
      error: null,
    });
  }

  function mockPublicRequests(data: unknown[]) {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data, error: null }),
    });
  }

  it("renders rows with and without email; status filter still works", async () => {
    const user = userEvent.setup();
    mockAuthenticatedUser("admin@keelworks.org");

    const mockData = [
      {
        id: "1",
        project_name: "Project Alpha",
        owner: "Alice",
        email: "alice@example.com",
        title: "Request A",
        status: "pending",
        target_start_date: null,
        created_at: "2024-01-01T00:00:00Z",
        developer_names: "Dev1",
      },
      {
        id: "2",
        project_name: "Project Beta",
        owner: "Bob",
        email: null,
        title: "Request B",
        status: "completed",
        target_start_date: null,
        created_at: "2024-01-02T00:00:00Z",
        developer_names: null,
      },
      {
        id: "3",
        project_name: "Project Gamma",
        owner: "Charlie",
        email: "",
        title: "Request C",
        status: "pending",
        target_start_date: null,
        created_at: "2024-01-03T00:00:00Z",
        developer_names: "Dev2",
      },
    ];

    mockPublicRequests(mockData);

    render(<QueuePage />);

    await waitFor(() => {
      expect(screen.getByText("Project Alpha")).toBeInTheDocument();
    });

    expect(screen.getByText("Project Beta")).toBeInTheDocument();
    expect(screen.getByText("Project Gamma")).toBeInTheDocument();

    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(4);

    const aliceRow = rows.find((row) => row.textContent?.includes("Alice"));
    expect(aliceRow).toBeDefined();
    expect(
      within(aliceRow!).getByTestId("copy-email-button")
    ).toBeInTheDocument();

    const bobRow = rows.find((row) => row.textContent?.includes("Bob"));
    expect(bobRow).toBeDefined();
    expect(within(bobRow!).queryByTestId("copy-email-button")).toBeNull();

    const charlieRow = rows.find((row) => row.textContent?.includes("Charlie"));
    expect(charlieRow).toBeDefined();
    expect(within(charlieRow!).queryByTestId("copy-email-button")).toBeNull();

    expect(screen.getByText(/showing 3 of 3 requests/i)).toBeInTheDocument();

    const filterSelect = screen.getByRole("combobox");
    await user.selectOptions(filterSelect, "completed");

    await waitFor(() => {
      expect(screen.getByText(/showing 1 of 3 requests/i)).toBeInTheDocument();
    });

    expect(screen.queryByText("Project Alpha")).not.toBeInTheDocument();
    expect(screen.getByText("Project Beta")).toBeInTheDocument();
    expect(screen.queryByText("Project Gamma")).not.toBeInTheDocument();

    await user.selectOptions(filterSelect, "pending");

    await waitFor(() => {
      expect(screen.getByText(/showing 2 of 3 requests/i)).toBeInTheDocument();
    });

    expect(screen.getByText("Project Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Project Beta")).not.toBeInTheDocument();
    expect(screen.getByText("Project Gamma")).toBeInTheDocument();
  });

  it("shows email next to owner name when email is present", async () => {
    mockAuthenticatedUser("admin@keelworks.org");

    const mockData = [
      {
        id: "1",
        project_name: "Project Alpha",
        owner: "Alice",
        email: "alice@example.com",
        title: "Request A",
        status: "pending",
        target_start_date: null,
        created_at: "2024-01-01T00:00:00Z",
        developer_names: "Dev1",
      },
    ];

    mockPublicRequests(mockData);

    render(<QueuePage />);

    await waitFor(() => {
      expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    });

    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("owner cell looks unchanged when email is not present", async () => {
    mockAuthenticatedUser("admin@keelworks.org");

    const mockData = [
      {
        id: "1",
        project_name: "Project Beta",
        owner: "Bob",
        email: null,
        title: "Request B",
        status: "completed",
        target_start_date: null,
        created_at: "2024-01-01T00:00:00Z",
        developer_names: null,
      },
    ];

    mockPublicRequests(mockData);

    render(<QueuePage />);

    await waitFor(() => {
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("copy-email-button")).not.toBeInTheDocument();
  });

  it("shows dash for null owner", async () => {
    mockAuthenticatedUser("admin@keelworks.org");

    const mockData = [
      {
        id: "1",
        project_name: "No Owner Project",
        owner: null,
        email: null,
        title: "Request",
        status: "pending",
        target_start_date: null,
        created_at: "2024-01-01T00:00:00Z",
        developer_names: null,
      },
    ];

    mockPublicRequests(mockData);

    render(<QueuePage />);

    await waitFor(() => {
      expect(screen.getByText("No Owner Project")).toBeInTheDocument();
    });

    const rows = screen.getAllByRole("row");
    const dataRow = rows[1];

    const ownerCell = within(dataRow).getAllByRole("cell")[4];
    expect(ownerCell).toHaveTextContent("—");
  });
});
