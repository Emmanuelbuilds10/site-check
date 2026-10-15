/**
 * TLS certificate inspection.
 *
 * We open a plain TLS connection to port 443 and read the certificate that the
 * site presents. `rejectUnauthorized: false` lets the handshake finish even for
 * a broken certificate, so we can inspect it and explain what is wrong instead
 * of just failing.
 */

import tls from "node:tls";

export interface TlsInfo {
  /** true when the certificate chains up to a trusted authority. */
  authorized: boolean;
  authorizationError: string | null;
  validFrom: string | null;
  validTo: string | null;
  expired: boolean;
}

export function inspectCertificate(hostname: string, timeoutMs = 8_000): Promise<TlsInfo> {
  return new Promise<TlsInfo>((resolve, reject) => {
    const socket = tls.connect(
      {
        host: hostname,
        port: 443,
        servername: hostname, // required by most servers (SNI)
        rejectUnauthorized: false,
        timeout: timeoutMs,
      },
      () => {
        try {
          const certificate = socket.getPeerCertificate();
          const validTo = certificate?.valid_to ? new Date(certificate.valid_to) : null;

          resolve({
            authorized: socket.authorized,
            authorizationError: socket.authorizationError
              ? String(socket.authorizationError)
              : null,
            validFrom: certificate?.valid_from ?? null,
            validTo: certificate?.valid_to ?? null,
            expired: validTo ? validTo.getTime() < Date.now() : false,
          });
        } catch (error) {
          reject(error instanceof Error ? error : new Error("Could not read the certificate."));
        } finally {
          socket.end();
        }
      },
    );

    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("The secure connection timed out."));
    });

    socket.on("error", (error) => {
      socket.destroy();
      reject(error);
    });
  });
}
