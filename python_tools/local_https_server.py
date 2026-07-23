#!/usr/bin/env python3
"""Simple local HTTPS static server for testing the game with self-signed certs."""

from __future__ import annotations

import argparse
import os
import ssl
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def parse_args() -> argparse.Namespace:
    root_dir = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="Serve the game locally over HTTPS.")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host. Default: 127.0.0.1")
    parser.add_argument("--port", type=int, default=8443, help="HTTPS port. Default: 8443")
    parser.add_argument(
        "--dir",
        default=str(root_dir),
        help=f"Directory to serve. Default: {root_dir}",
    )
    parser.add_argument("--cert", required=True, help="Path to the TLS certificate PEM file")
    parser.add_argument("--key", required=True, help="Path to the TLS private key PEM file")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    serve_dir = Path(args.dir).resolve()
    cert_path = Path(args.cert).resolve()
    key_path = Path(args.key).resolve()

    if not serve_dir.is_dir():
        raise SystemExit(f"Serve directory does not exist: {serve_dir}")
    if not cert_path.is_file():
        raise SystemExit(f"Certificate file does not exist: {cert_path}")
    if not key_path.is_file():
        raise SystemExit(f"Key file does not exist: {key_path}")

    handler = partial(SimpleHTTPRequestHandler, directory=os.fspath(serve_dir))
    httpd = ThreadingHTTPServer((args.host, args.port), handler)

    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile=os.fspath(cert_path), keyfile=os.fspath(key_path))
    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

    print(f"Serving {serve_dir} at https://{args.host}:{args.port}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
