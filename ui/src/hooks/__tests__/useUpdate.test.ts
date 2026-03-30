import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useUpdate } from "../useUpdate";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useUpdate", () => {
  it("loads portable and OpenClaw versions from local APIs", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ version: "1.0.0" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ version: "3.22.0" }),
      } as Response);

    const { result } = renderHook(() => useUpdate());

    await act(async () => {
      await result.current.refreshVersionInfo();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.versionInfo).toEqual({
      current: "1.0.0",
      openclawVersion: "3.22.0",
    });
  });

  it("works when openclaw-version fails", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ version: "1.0.0" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}),
      } as Response);

    const { result } = renderHook(() => useUpdate());

    await act(async () => {
      await result.current.refreshVersionInfo();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.versionInfo).toEqual({
      current: "1.0.0",
      openclawVersion: undefined,
    });
  });

  it("sets error when version API fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const { result } = renderHook(() => useUpdate());

    await act(async () => {
      await result.current.refreshVersionInfo();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
  });
});
