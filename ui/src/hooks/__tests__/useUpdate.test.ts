import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useUpdate } from "../useUpdate";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useUpdate", () => {
  it("checks version and reports up to date", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ version: "1.0.0" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tag_name: "v1.0.0" }),
      } as Response);

    const { result } = renderHook(() => useUpdate());

    await act(async () => {
      await result.current.checkForUpdates();
    });

    await waitFor(() => {
      expect(result.current.checking).toBe(false);
    });

    expect(result.current.versionInfo).toEqual({
      current: "1.0.0",
      latest: "1.0.0",
      updateAvailable: false,
    });
  });

  it("detects available update", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ version: "1.0.0" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tag_name: "v1.1.0" }),
      } as Response);

    const { result } = renderHook(() => useUpdate());

    await act(async () => {
      await result.current.checkForUpdates();
    });

    await waitFor(() => {
      expect(result.current.checking).toBe(false);
    });

    expect(result.current.versionInfo?.updateAvailable).toBe(true);
    expect(result.current.versionInfo?.latest).toBe("1.1.0");
  });

  it("handles network error gracefully", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ version: "1.0.0" }),
      } as Response)
      .mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useUpdate());

    await act(async () => {
      await result.current.checkForUpdates();
    });

    await waitFor(() => {
      expect(result.current.checking).toBe(false);
    });

    expect(result.current.versionInfo?.current).toBe("1.0.0");
    expect(result.current.versionInfo?.updateAvailable).toBe(false);
  });

  it("handles version check failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const { result } = renderHook(() => useUpdate());

    await act(async () => {
      await result.current.checkForUpdates();
    });

    await waitFor(() => {
      expect(result.current.checking).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
  });
});
