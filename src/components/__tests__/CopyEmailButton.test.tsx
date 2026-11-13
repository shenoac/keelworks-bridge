import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CopyEmailButton from "../CopyEmailButton";

describe("CopyEmailButton", () => {
  let originalClipboard: Clipboard | undefined;

  beforeEach(() => {
    originalClipboard = navigator.clipboard;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    if (originalClipboard !== undefined) {
      Object.defineProperty(navigator, "clipboard", {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });
    }
  });

  function mockClipboard(writeTextFn: (text: string) => Promise<void>) {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextFn },
      writable: true,
      configurable: true,
    });
  }

  function mockClipboardUndefined() {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      writable: true,
      configurable: true,
    });
  }

  it("renders button with correct aria-label given an email", () => {
    mockClipboard(vi.fn().mockResolvedValue(undefined));
    render(<CopyEmailButton email="test@example.com" label="John Doe" />);

    const button = screen.getByRole("button", {
      name: /copy email for john doe/i,
    });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("type", "button");
  });

  it("renders button with email in aria-label when no label is provided", () => {
    mockClipboard(vi.fn().mockResolvedValue(undefined));
    render(<CopyEmailButton email="test@example.com" />);

    const button = screen.getByRole("button", {
      name: /copy email test@example\.com/i,
    });
    expect(button).toBeInTheDocument();
  });

  describe("renders nothing for empty/invalid emails", () => {
    it("renders nothing for null", () => {
      const { container } = render(<CopyEmailButton email={null} />);
      expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing for undefined", () => {
      const { container } = render(<CopyEmailButton email={undefined} />);
      expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing for empty string", () => {
      const { container } = render(<CopyEmailButton email="" />);
      expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing for whitespace-only string", () => {
      const { container } = render(<CopyEmailButton email="   " />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  it("click calls writeText with the exact trimmed email", async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeTextMock);

    render(<CopyEmailButton email="  test@example.com  " label="Test" />);

    const button = screen.getByRole("button");
    await user.click(button);

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    expect(writeTextMock).toHaveBeenCalledWith("test@example.com");
  });

  it("success shows copied state; live region announces it", async () => {
    const user = userEvent.setup();
    mockClipboard(vi.fn().mockResolvedValue(undefined));

    render(<CopyEmailButton email="test@example.com" label="Test" />);

    const button = screen.getByRole("button");
    await user.click(button);

    const liveRegion = screen.getByRole("status");
    expect(liveRegion).toHaveTextContent(/copied/i);
  });

  it("writeText rejects -> error state, never 'Copied'", async () => {
    const user = userEvent.setup();
    mockClipboard(vi.fn().mockRejectedValue(new Error("Copy failed")));

    render(<CopyEmailButton email="test@example.com" label="Test" />);

    const button = screen.getByRole("button");
    await user.click(button);

    const liveRegion = screen.getByRole("status");
    expect(liveRegion).toHaveTextContent(/copy failed/i);
    expect(liveRegion).not.toHaveTextContent(/^Copied$/);
  });

  it("navigator.clipboard undefined -> error state, no throw", async () => {
    const user = userEvent.setup();
    mockClipboardUndefined();

    render(<CopyEmailButton email="test@example.com" label="Test" />);

    const button = screen.getByRole("button");

    await expect(user.click(button)).resolves.not.toThrow();

    const liveRegion = screen.getByRole("status");
    expect(liveRegion).toHaveTextContent(/copy failed/i);
  });

  it("resets to idle after timeout (fake timers)", async () => {
    vi.useFakeTimers();
    mockClipboard(vi.fn().mockResolvedValue(undefined));

    render(<CopyEmailButton email="test@example.com" label="Test" />);

    const button = screen.getByRole("button");
    
    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });

    const liveRegion = screen.getByRole("status");
    expect(liveRegion).toHaveTextContent(/copied/i);

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(liveRegion).toHaveTextContent("");
  });

  it("rapid double click keeps a single timer and correct final state", async () => {
    vi.useFakeTimers();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeTextMock);

    render(<CopyEmailButton email="test@example.com" label="Test" />);

    const button = screen.getByRole("button");

    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });
    
    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });

    expect(writeTextMock).toHaveBeenCalledTimes(2);

    const liveRegion = screen.getByRole("status");
    expect(liveRegion).toHaveTextContent(/copied/i);

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(liveRegion).toHaveTextContent(/copied/i);

    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(liveRegion).toHaveTextContent("");
  });

  it("multiple buttons: each copies its own email; only the clicked one shows feedback", async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeTextMock);

    render(
      <div>
        <CopyEmailButton email="alice@example.com" label="Alice" />
        <CopyEmailButton email="bob@example.com" label="Bob" />
      </div>
    );

    const aliceButton = screen.getByRole("button", {
      name: /copy email for alice/i,
    });
    const bobButton = screen.getByRole("button", {
      name: /copy email for bob/i,
    });

    await user.click(aliceButton);

    expect(writeTextMock).toHaveBeenLastCalledWith("alice@example.com");

    const aliceContainer = aliceButton.parentElement!;
    const bobContainer = bobButton.parentElement!;

    const aliceLiveRegion = within(aliceContainer).getByRole("status");
    const bobLiveRegion = within(bobContainer).getByRole("status");

    expect(aliceLiveRegion).toHaveTextContent(/copied/i);
    expect(bobLiveRegion).toHaveTextContent("");
  });

  describe("keyboard accessibility", () => {
    it("Tab focuses the button", async () => {
      const user = userEvent.setup();
      mockClipboard(vi.fn().mockResolvedValue(undefined));

      render(
        <div>
          <button>Before</button>
          <CopyEmailButton email="test@example.com" label="Test" />
        </div>
      );

      const copyButton = screen.getByRole("button", {
        name: /copy email for test/i,
      });

      await user.tab();
      await user.tab();

      expect(copyButton).toHaveFocus();
    });

    it("Enter triggers copy", async () => {
      const user = userEvent.setup();
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      mockClipboard(writeTextMock);

      render(<CopyEmailButton email="test@example.com" label="Test" />);

      const button = screen.getByRole("button");
      button.focus();
      await user.keyboard("{Enter}");

      expect(writeTextMock).toHaveBeenCalledWith("test@example.com");
    });

    it("Space triggers copy", async () => {
      const user = userEvent.setup();
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      mockClipboard(writeTextMock);

      render(<CopyEmailButton email="test@example.com" label="Test" />);

      const button = screen.getByRole("button");
      button.focus();
      await user.keyboard(" ");

      expect(writeTextMock).toHaveBeenCalledWith("test@example.com");
    });
  });

  it("unmount mid-timeout causes no state-update warning/error", async () => {
    vi.useFakeTimers();
    mockClipboard(vi.fn().mockResolvedValue(undefined));

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { unmount } = render(
      <CopyEmailButton email="test@example.com" label="Test" />
    );

    const button = screen.getByRole("button");
    
    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });

    unmount();

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    const stateUpdateWarnings = consoleErrorSpy.mock.calls.filter(
      (call) =>
        call.some(
          (arg) =>
            typeof arg === "string" &&
            (arg.includes("Cannot update a component") ||
              arg.includes("state update on an unmounted"))
        )
    );

    expect(stateUpdateWarnings).toHaveLength(0);

    consoleErrorSpy.mockRestore();
  });
});
