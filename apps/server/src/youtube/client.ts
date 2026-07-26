import { createHash, timingSafeEqual } from "node:crypto";

const API_ROOT = "https://www.googleapis.com/youtube/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";

export type YouTubeOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type YouTubeComment = {
  id: string;
  videoId: string;
  videoTitle?: string;
  authorId?: string;
  authorName: string;
  text: string;
  publishedAt: string;
  canReply: boolean;
};

export type YouTubeVideo = {
  id: string;
  title: string;
  thumbnailUrl?: string;
};

type FetchFn = typeof fetch;

export class YouTubeClient {
  public constructor(private readonly fetchFn: FetchFn = fetch) {}

  public authorizationUrl(config: YouTubeOAuthConfig, state: string) {
    const url = new URL(AUTH_URL);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", config.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPE);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("state", state);
    return url.toString();
  }

  public async exchangeCode(config: YouTubeOAuthConfig, code: string) {
    return this.token({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    });
  }

  public async refresh(config: YouTubeOAuthConfig, refreshToken: string) {
    return this.token({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
  }

  public async ownedChannel(accessToken: string) {
    const payload = await this.request<{
      items?: Array<{ id: string; snippet?: { title?: string } }>;
    }>("/channels?part=snippet&mine=true&maxResults=1", accessToken);
    const channel = payload.items?.[0];
    if (!channel?.id)
      throw new YouTubeApiError("No owned YouTube channel was found for this account.");
    return { id: channel.id, name: channel.snippet?.title ?? "YouTube channel" };
  }

  public async ownedVideos(accessToken: string): Promise<YouTubeVideo[]> {
    const query = new URLSearchParams({
      part: "snippet",
      forMine: "true",
      type: "video",
      order: "date",
      maxResults: "50",
    });
    const payload = await this.request<{
      items?: Array<{
        id?: { videoId?: string };
        snippet?: {
          title?: string;
          thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
        };
      }>;
    }>(`/search?${query}`, accessToken);
    return (payload.items ?? [])
      .map((item): YouTubeVideo | undefined => {
        const id = item.id?.videoId;
        const snippet = item.snippet;
        const title = snippet?.title;
        if (!id || !title) return undefined;
        return {
          id,
          title,
          thumbnailUrl: snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url,
        };
      })
      .filter((video): video is YouTubeVideo => Boolean(video));
  }

  public async recentComments(accessToken: string, channelId: string) {
    const query = new URLSearchParams({
      part: "snippet",
      allThreadsRelatedToChannelId: channelId,
      order: "time",
      maxResults: "50",
      textFormat: "plainText",
    });
    const payload = await this.request<{
      items?: Array<{
        snippet?: {
          canReply?: boolean;
          videoId?: string;
          topLevelComment?: {
            id?: string;
            snippet?: {
              authorChannelId?: { value?: string };
              authorDisplayName?: string;
              textDisplay?: string;
              publishedAt?: string;
              videoId?: string;
            };
          };
        };
      }>;
    }>(`/commentThreads?${query}`, accessToken);
    return (payload.items ?? [])
      .map((thread): YouTubeComment | undefined => {
        const top = thread.snippet?.topLevelComment;
        const snippet = top?.snippet;
        const videoId = thread.snippet?.videoId ?? snippet?.videoId;
        if (
          !top?.id ||
          !snippet?.authorDisplayName ||
          !snippet.textDisplay ||
          !snippet.publishedAt ||
          !videoId
        ) {
          return undefined;
        }
        return {
          id: top.id,
          videoId,
          authorId: snippet.authorChannelId?.value,
          authorName: snippet.authorDisplayName,
          text: snippet.textDisplay,
          publishedAt: snippet.publishedAt,
          canReply: Boolean(thread.snippet?.canReply),
        };
      })
      .filter((comment): comment is YouTubeComment => Boolean(comment));
  }

  public async recentCommentsForVideos(accessToken: string, videoIds: string[]) {
    const batches = await Promise.all(
      videoIds.map(async (videoId) => {
        const query = new URLSearchParams({
          part: "snippet",
          videoId,
          order: "time",
          maxResults: "100",
          textFormat: "plainText",
        });
        const payload = await this.request<{
          items?: Array<{
            snippet?: {
              canReply?: boolean;
              videoId?: string;
              topLevelComment?: {
                id?: string;
                snippet?: {
                  authorChannelId?: { value?: string };
                  authorDisplayName?: string;
                  textDisplay?: string;
                  publishedAt?: string;
                  videoId?: string;
                };
              };
            };
          }>;
        }>(`/commentThreads?${query}`, accessToken);
        return this.commentsFromThreads(payload.items ?? []);
      }),
    );
    return batches.flat();
  }

  public async reply(accessToken: string, parentId: string, text: string) {
    await this.request("/comments?part=snippet", accessToken, "POST", {
      snippet: { parentId, textOriginal: text },
    });
  }

  private async token(body: Record<string, string>) {
    const response = await this.fetchFn(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!response.ok || !payload.access_token) {
      throw new YouTubeApiError(payload.error ?? "YouTube authorization failed.");
    }
    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresIn: payload.expires_in ?? 3_600,
    };
  }

  private async request<T>(
    path: string,
    accessToken: string,
    method: "GET" | "POST" = "GET",
    body?: unknown,
  ): Promise<T> {
    const response = await this.fetchFn(`${API_ROOT}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${accessToken}`,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload = (await response.json().catch(() => ({}))) as T & {
      error?: { message?: string };
    };
    if (!response.ok)
      throw new YouTubeApiError(payload.error?.message ?? "YouTube request failed.");
    return payload;
  }

  private commentsFromThreads(
    threads: Array<{
      snippet?: {
        canReply?: boolean;
        videoId?: string;
        topLevelComment?: {
          id?: string;
          snippet?: {
            authorChannelId?: { value?: string };
            authorDisplayName?: string;
            textDisplay?: string;
            publishedAt?: string;
            videoId?: string;
          };
        };
      };
    }>,
  ) {
    return threads
      .map((thread): YouTubeComment | undefined => {
        const top = thread.snippet?.topLevelComment;
        const snippet = top?.snippet;
        const videoId = thread.snippet?.videoId ?? snippet?.videoId;
        if (
          !top?.id ||
          !snippet?.authorDisplayName ||
          !snippet.textDisplay ||
          !snippet.publishedAt ||
          !videoId
        )
          return undefined;
        return {
          id: top.id,
          videoId,
          authorId: snippet.authorChannelId?.value,
          authorName: snippet.authorDisplayName,
          text: snippet.textDisplay,
          publishedAt: snippet.publishedAt,
          canReply: Boolean(thread.snippet?.canReply),
        };
      })
      .filter((comment): comment is YouTubeComment => Boolean(comment));
  }
}

export class YouTubeApiError extends Error {}

export function signOAuthState(deploymentId: string, clientSecret: string, now = Date.now()) {
  const payload = `${deploymentId}.${Math.floor(now / 1_000)}`;
  const signature = createHash("sha256").update(`${payload}.${clientSecret}`).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyOAuthState(state: string, clientSecret: string, maxAgeSeconds = 600) {
  const [deploymentId, issuedAt, signature] = state.split(".");
  if (!deploymentId || !issuedAt || !signature || !/^\d+$/.test(issuedAt)) return undefined;
  const payload = `${deploymentId}.${issuedAt}`;
  const expected = createHash("sha256").update(`${payload}.${clientSecret}`).digest("base64url");
  const received = Buffer.from(signature);
  const comparison = Buffer.from(expected);
  if (received.length !== comparison.length || !timingSafeEqual(received, comparison))
    return undefined;
  if (Math.abs(Date.now() - Number(issuedAt) * 1_000) > maxAgeSeconds * 1_000) return undefined;
  return deploymentId;
}
