import { jest } from "@jest/globals";
import { OrgSettings } from "@baseplate-sdk/utils";
import { handleApps } from "./handleApps";
import { MockCloudflareKV } from "./setupTests";

describe(`handleApps`, () => {
  let response: Response,
    mockFetch = jest.fn();

  beforeEach(() => {
    mockFetch = jest.fn();
    // @ts-ignore
    global.fetch = mockFetch;

    response = null;
  });

  it(`determines correct proxy url when using Baseplate hosting`, async () => {
    mockFetch.mockReturnValueOnce(
      new Response("console.log('hi');", {
        status: 200,
      })
    );

    response = await handleApps(
      new Request(
        "https://cdn.single-spa-baseplate.com/walmart/apps/navbar/c1a777c770ee187cebedd0724653c771495f2af9/react-mf-navbar.js"
      ),
      {
        orgKey: "walmart",
        customerEnv: "prod",
        pathParts: [
          "navbar",
          "c1a777c770ee187cebedd0724653c771495f2af9",
          "react-mf-navbar.js",
        ],
      }
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect((mockFetch.mock.calls[0][0] as Request).url).toBe(
      "undefinednavbar/c1a777c770ee187cebedd0724653c771495f2af9/react-mf-navbar.js"
    );
  });

  it(`determines correct proxy url when not using custom hosting`, async () => {
    const orgSettings: RecursivePartial<OrgSettings> = {
      orgExists: true,
      staticFiles: {
        microfrontendProxy: {
          environments: {
            prod: {
              useBaseplateHosting: false,
              host: "https://cdn.walmart.com/",
            },
          },
        },
      },
    };

    (global.MAIN_KV as MockCloudflareKV).mockKv({
      "org-settings-walmart": orgSettings,
    });
    mockFetch.mockReturnValueOnce(
      new Response("console.log('hi');", {
        status: 200,
      })
    );

    response = await handleApps(
      new Request(
        "https://cdn.baseplate.cloud/walmart/apps/navbar/c1a777c770ee187cebedd0724653c771495f2af9/react-mf-navbar.js"
      ),
      {
        orgKey: "walmart",
        customerEnv: "prod",
        pathParts: [
          "navbar",
          "c1a777c770ee187cebedd0724653c771495f2af9",
          "react-mf-navbar.js",
        ],
      }
    );

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect((mockFetch.mock.calls[0][0] as Request).url).toBe(
      "https://cdn.walmart.com/navbar/c1a777c770ee187cebedd0724653c771495f2af9/react-mf-navbar.js"
    );
  });

  it(`appends cors headers to cross origin requests`, async () => {
    mockFetch.mockReturnValueOnce(
      new Response("console.log('hi');", {
        status: 200,
      })
    );

    response = await handleApps(
      new Request(
        "https://cdn.baseplate.cloud/walmart/apps/navbar/c1a777c770ee187cebedd0724653c771495f2af9/react-mf-navbar.js",
        {
          headers: {
            // this makes it a cross-origin request
            Origin: "example.com",
          },
        }
      ),
      {
        orgKey: "walmart",
        customerEnv: "prod",
        pathParts: [
          "navbar",
          "c1a777c770ee187cebedd0724653c771495f2af9",
          "react-mf-navbar.js",
        ],
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBeTruthy();
  });

  it(`appends baseplate-version header to apps`, async () => {
    mockFetch.mockReturnValueOnce(
      new Response("console.log('hi');", {
        status: 200,
      })
    );

    response = await handleApps(
      new Request(
        "https://cdn.baseplate.cloud/walmart/apps/navbar/c1a777c770ee187cebedd0724653c771495f2af9/react-mf-navbar.js"
      ),
      {
        orgKey: "walmart",
        customerEnv: "prod",
        pathParts: [
          "navbar",
          "c1a777c770ee187cebedd0724653c771495f2af9",
          "react-mf-navbar.js",
        ],
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("baseplate-version")).toBeTruthy();
  });

  it(`sets cache-control header for apps`, async () => {
    mockFetch.mockReturnValueOnce(
      new Response("console.log('hi');", {
        status: 200,
      })
    );

    response = await handleApps(
      new Request(
        "https://cdn.baseplate.cloud/walmart/apps/navbar/c1a777c770ee187cebedd0724653c771495f2af9/react-mf-navbar.js"
      ),
      {
        orgKey: "walmart",
        customerEnv: "prod",
        pathParts: [
          "navbar",
          "c1a777c770ee187cebedd0724653c771495f2af9",
          "react-mf-navbar.js",
        ],
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable"
    );
  });
});

// https://stackoverflow.com/questions/41980195/recursive-partialt-in-typescript
type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends object
    ? RecursivePartial<T[P]>
    : T[P];
};
