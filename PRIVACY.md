# Privacy policy

Satchel is a desktop API client that runs on your computer. It has no account and no telemetry, and the project runs no server that the app talks to.

## What stays on your computer

- **Your workspace:** collections, requests, environments and variables are stored on your computer: in the app until you choose a location, then in the file or folder you pick. Variables you mark secret are kept out of shared files and stored in your system's credential store (Windows Credential Manager, macOS Keychain, or Secret Service on Linux), or in a file only you can read where none is available.
- **Imports:** Postman exports and `curl` commands are read on your computer. Postman isn't contacted.

## What leaves your computer

- **Your requests:** the app sends each request to the address you give it, only when you send it (or run a rate-limit burst), and shows you the response. What a request carries — headers, credentials, body — is what you put in it.
- **Git, if you use it:** when a workspace folder is a git repository, the app runs your own `git` when you click Pull, Push or Fetch, and git talks to the remote you configured, with your own credentials.

## Contact

Questions about privacy: open an issue at <https://github.com/matheuscaet/satchel/issues>.
