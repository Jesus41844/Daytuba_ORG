import type { MoodleCourse, MoodleEvent } from "../types";

interface MoodleClientConfig {
  baseUrl: string;
  username: string;
  password: string;
}

interface MoodleAjaxResponse<T = unknown> {
  error: boolean;
  data: T;
  debugginginfo?: string;
  exception?: {
    message: string;
    errorcode: string;
    link?: string;
  };
}

interface ActionEventsResponse {
  events: MoodleEvent[];
  firstid: number;
  lastid: number;
}

interface EnrolledCoursesResponse {
  courses: MoodleCourse[];
}

export class MoodleClient {
  private baseUrl: string;
  private username: string;
  private password: string;
  private cookies = new Map<string, string>();
  private sesskey: string | null = null;

  constructor(config: MoodleClientConfig) {
    this.baseUrl = config.baseUrl;
    this.username = config.username;
    this.password = config.password;
  }

  private getCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  private parseCookies(headers: Headers): void {
    const setCookies = headers.getSetCookie?.() ?? [];
    for (const header of setCookies) {
      const parts = header.split(";")[0]?.split("=");
      if (parts && parts.length >= 2) {
        const name = parts[0]!.trim();
        const value = parts.slice(1).join("=").trim();
        this.cookies.set(name, value);
      }
    }
  }

  private async fetchWithCookies(
    url: string,
    options: RequestInit = {},
    followRedirects = true
  ): Promise<Response> {
    const headers = new Headers(options.headers);
    if (this.cookies.size > 0) {
      headers.set("Cookie", this.getCookieHeader());
    }
    if (!headers.has("User-Agent")) {
      headers.set(
        "User-Agent",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      );
    }

    if (followRedirects) {
      const response = await fetch(url, { ...options, headers });
      this.parseCookies(response.headers);
      return response;
    }

    let response = await fetch(url, {
      ...options,
      headers,
      redirect: "manual",
    });
    this.parseCookies(response.headers);

    let count = 0;
    while (
      (response.status === 301 ||
        response.status === 302 ||
        response.status === 303 ||
        response.status === 307) &&
      count < 10
    ) {
      const location = response.headers.get("Location");
      if (!location) break;

      const nextUrl = location.startsWith("http")
        ? location
        : `${this.baseUrl}${location.startsWith("/") ? "" : "/"}${location}`;

      const redirectHeaders = new Headers();
      if (this.cookies.size > 0) {
        redirectHeaders.set("Cookie", this.getCookieHeader());
      }
      redirectHeaders.set(
        "User-Agent",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      );

      response = await fetch(nextUrl, {
        headers: redirectHeaders,
        redirect: "manual",
      });
      this.parseCookies(response.headers);
      count++;
    }

    return response;
  }

  private hasSessionCookie(): boolean {
    for (const key of this.cookies.keys()) {
      if (
        key.toLowerCase().includes("moodlesession") ||
        key.toLowerCase().includes("moodlecookie")
      ) {
        return true;
      }
    }
    return false;
  }

  async login(): Promise<void> {
    // 1. GET login page — extract logintoken
    const loginPage = await this.fetchWithCookies(
      `${this.baseUrl}/login/index.php`,
      {},
      true
    );
    const loginHtml = await loginPage.text();

    const tokenMatch = loginHtml.match(
      /name="logintoken"\s+value="([^"]+)"/
    );
    const logintoken = tokenMatch?.[1] ?? "";

    // 2. POST credentials
    const body = new URLSearchParams({
      username: this.username,
      password: this.password,
      logintoken,
      anchor: "",
    });

    const loginResponse = await this.fetchWithCookies(
      `${this.baseUrl}/login/index.php`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      },
      false // manual redirect handling
    );

    // 3. Follow redirects manually to land on dashboard
    let finalResponse = loginResponse;
    let redirectCount = 0;
    while (
      (finalResponse.status === 301 ||
        finalResponse.status === 302 ||
        finalResponse.status === 303 ||
        finalResponse.status === 307) &&
      redirectCount < 10
    ) {
      const location = finalResponse.headers.get("Location");
      if (!location) break;

      const nextUrl = location.startsWith("http")
        ? location
        : `${this.baseUrl}${location.startsWith("/") ? "" : "/"}${location}`;

      const redirectHeaders = new Headers();
      if (this.cookies.size > 0) {
        redirectHeaders.set("Cookie", this.getCookieHeader());
      }
      redirectHeaders.set(
        "User-Agent",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      );

      finalResponse = await fetch(nextUrl, {
        headers: redirectHeaders,
        redirect: "manual",
      });
      this.parseCookies(finalResponse.headers);
      redirectCount++;
    }

    // 4. Verify login succeeded — check for session cookie
    if (!this.hasSessionCookie()) {
      const dashboardHtml = await finalResponse.text();
      if (
        dashboardHtml.includes("loginerrors") ||
        dashboardHtml.includes("login-form")
      ) {
        throw new Error(
          "Credenciales inválidas o error de login en " + this.baseUrl
        );
      }
    }

    // 5. Fetch the dashboard page to extract sesskey
    const dashboardResponse = await this.fetchWithCookies(
      `${this.baseUrl}/my/`,
      {},
      true
    );
    const dashboardHtml = await dashboardResponse.text();

    const sesskeyMatch = dashboardHtml.match(
      /"sesskey":"([A-Za-z0-9]+)"/
    );
    this.sesskey = sesskeyMatch?.[1] ?? null;

    if (!this.sesskey) {
      const fallbackMatch = dashboardHtml.match(
        /sesskey=([A-Za-z0-9]+)/
      );
      this.sesskey = fallbackMatch?.[1] ?? null;
    }

    if (!this.sesskey) {
      throw new Error(
        "No se pudo obtener sesskey de " + this.baseUrl
      );
    }
  }

  // Test that session is valid using an AJAX-available function
  async testConnection(): Promise<{ valid: boolean; courseCount?: number }> {
    try {
      const data = await this.ajaxCall<{ courses: unknown[] }>(
        "core_course_get_enrolled_courses_by_timeline_classification",
        {
          classification: "inprogress",
          limit: 1,
          offset: 0,
          sort: "fullname",
        }
      );
      return { valid: true, courseCount: data?.courses?.length };
    } catch {
      return { valid: false };
    }
  }

  private async ajaxCall<T>(
    methodName: string,
    args: Record<string, unknown> = {}
  ): Promise<T> {
    if (!this.sesskey) {
      throw new Error("No hay sesión activa. Llama a login() primero.");
    }

    const url = `${this.baseUrl}/lib/ajax/service.php?sesskey=${this.sesskey}&info=${methodName}`;

    const body = JSON.stringify([
      {
        index: 0,
        methodname: methodName,
        args,
      },
    ]);

    const response = await this.fetchWithCookies(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body,
    });

    const text = await response.text();

    let json: MoodleAjaxResponse<T>[];
    try {
      json = JSON.parse(text);
    } catch {
      console.error(
        `[MoodleClient] Respuesta no-JSON de ${this.baseUrl} (${response.status}):`,
        text.slice(0, 500)
      );
      throw new Error(
        `Respuesta no-JSON de Moodle (${response.status}): ${text.slice(0, 200)}`
      );
    }

    if (!json || !Array.isArray(json) || json.length === 0) {
      console.error(
        `[MoodleClient] Respuesta inesperada de ${this.baseUrl}:`,
        text.slice(0, 500)
      );
      throw new Error("Respuesta vacía o con formato inesperado de Moodle AJAX");
    }

    const result = json[0]!;

    if (result.error) {
      const detail = result.exception?.message
        ?? (typeof result.data === "string" ? result.data : null)
        ?? result.debugginginfo
        ?? JSON.stringify(result.data ?? result);

      console.error(
        `[MoodleClient] AJAX error en ${methodName} de ${this.baseUrl}:`,
        JSON.stringify(result).slice(0, 500)
      );

      throw new Error(`Moodle AJAX error en ${methodName}: ${detail}`);
    }

    return result.data;
  }

  async getEnrolledCourses(): Promise<MoodleCourse[]> {
    const data = await this.ajaxCall<EnrolledCoursesResponse>(
      "core_course_get_enrolled_courses_by_timeline_classification",
      {
        classification: "inprogress",
        limit: 50,
        offset: 0,
        sort: "fullname",
      }
    );

    const inprogress = data.courses ?? [];

    const pastData = await this.ajaxCall<EnrolledCoursesResponse>(
      "core_course_get_enrolled_courses_by_timeline_classification",
      {
        classification: "past",
        limit: 50,
        offset: 0,
        sort: "fullname",
      }
    );

    return [...inprogress, ...(pastData.courses ?? [])];
  }

  async getUpcomingEvents(daysAhead = 60): Promise<MoodleEvent[]> {
    const now = Math.floor(Date.now() / 1000);
    const future = now + daysAhead * 24 * 60 * 60;

    const allEvents: MoodleEvent[] = [];
    let lastId = 0;
    let hasMore = true;

    while (hasMore) {
      const data = await this.ajaxCall<ActionEventsResponse>(
        "core_calendar_get_action_events_by_timesort",
        {
          timesortfrom: now,
          timesortto: future,
          limitnum: 50,
          limittononsuspendedevents: true,
          aftereventid: lastId,
        }
      );

      const events = data.events ?? [];
      allEvents.push(...events);

      if (events.length < 50) {
        hasMore = false;
      } else {
        lastId = events[events.length - 1]!.id;
      }
    }

    return allEvents.filter(
      (e) =>
        e.modulename === "assign" ||
        e.modulename === "quiz" ||
        e.modulename === "workshop"
    );
  }
}
