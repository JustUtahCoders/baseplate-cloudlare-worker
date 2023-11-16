import { getOrgSettings } from "./getOrgSettings";
import { RequestLog } from "./logRequests";
import { EnvVars } from "./main";
import { internalErrorResponse, notFoundResponse } from "./responseUtils";
import indexHtmlTemplate from "./indexHtml.mustache";
import { corsHeaders } from "./cors";
import { baseplateVersion } from "./baseplateVersion";
import Mustache from "mustache";
import {
  HTMLTemplateParams,
  mergeDefaultHtmlParams,
} from "../../baseplate-utils/lib/htmlParams";
import { readImportMap, verifyImportMap } from "./handleImportMap";

export async function handleIndexHtml(
  request: Request,
  params: HandleIndexHtmlParams,
  requestLog: RequestLog,
  env: EnvVars,
  orgKey?: string
): Promise<Response> {
  if (!orgKey) {
    console.error(
      `No orgKey passed to handleIndexHtml function. Returning HTTP 500.`
    );
    return internalErrorResponse(request);
  }

  const [orgSettings, templateParameters] = await Promise.all([
    getOrgSettings(orgKey, env),
    env.MAIN_KV.get(`html-file-${orgKey}-${params.htmlFileName}`, {
      type: "json",
    }),
  ]);

  if (!orgSettings.orgExists || !templateParameters) {
    return notFoundResponse(request, orgSettings);
  }

  const finalParams: FinalHTMLTemplateParams =
    mergeDefaultHtmlParams(templateParameters);

  const importMap = await readImportMap(
    {
      importMapName: finalParams.importMap.name,
      customerEnv: params.customerEnv,
    },
    env,
    orgKey
  );
  const importMapErrors = verifyImportMap(importMap);

  if (importMapErrors.length > 0) {
    console.error(
      `Import Map Invalid for org ${orgKey} and request URL ${request.url}!`
    );
    console.error(importMapErrors);
    return internalErrorResponse(request, orgSettings);
  }

  // Add derived properties used in MustacheJS template
  if (finalParams.importMap.type === "systemjs") {
    finalParams.importMap.isSystemJS = true;
  }
  finalParams.importMap.json = JSON.stringify(importMap!, null, 2);
  finalParams.importMap.url = new URL(
    `./${finalParams.importMap.name}.importmap`,
    request.url
  ).href;

  for (let preload of finalParams.preloads) {
    if (preload.importSpecifier) {
      if (importMap?.imports[preload.importSpecifier]) {
        preload.href = importMap.imports[preload.importSpecifier];
      } else {
        console.error(
          `import specifier '${preload.importSpecifier}' cannot be preloaded because it doesn't exist in the import map`
        );
        return internalErrorResponse(request, orgSettings);
      }
    }
  }

  const html = Mustache.render(indexHtmlTemplate, finalParams);

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html",
      "cache-control": "public, max-age=3600",
      "content-security-policy":
        "default-src 'self' https: localhost:*; script-src 'unsafe-inline' 'unsafe-eval' https: localhost:*; connect-src https: localhost:* ws://localhost:*; style-src 'unsafe-inline' https:; object-src 'none';",
      ...corsHeaders(request, orgSettings),
      ...baseplateVersion(),
    },
  });
}

export interface HandleIndexHtmlParams {
  customerEnv: string;
  htmlFileName: string;
}

type FinalHTMLTemplateParams = HTMLTemplateParams & {
  importMap: HTMLTemplateParams["importMap"] & {
    isSystemJS?: boolean;
    json?: string;
    url?: string;
  };
};
