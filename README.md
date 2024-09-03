
```markdown
# Online CloakShare

This project is a clipboard application that allows users to save text or upload files temporarily. The saved text or uploaded files are accessible via a unique code and can be set to be automatically deleted after a specified time.

## Features

- **File Upload**: Users can upload a file from their local system. The file size should be less than 100MB.
- **Expiration Time**: Users can set an expiration time for the uploaded file. The maximum expiration time is 2880 minutes.
- **File Retrieval**: Users can retrieve the uploaded file using a unique code provided after the file upload.
- **Copy to Clipboard**: Users can copy the unique code to their clipboard.

## Getting Started

To get a local copy up and running, follow these steps:

1. Clone the repository to your local machine.
2. Install the required dependencies by running `npm install` in both the `client` and `server` directories.
3. Start the development server by running `npm run dev` in the `client` directory.
4. Start the backend server by running `node index.js` in the `server` directory.

## Project Structure

### Client

```
client/
	.eslintrc.cjs
	.gitignore
	index.html
	package.json
	public/
	README.md
	src/
		App.css
		App.tsx
		assets/
		Config.tsx
		Footer/
			Footer.css
			Footer.tsx
		Home/
			Home.css
			Home.tsx
		index.css
		main.tsx
		vite-env.d.ts
	tsconfig.json
	tsconfig.node.json
	vercel.json
	vite.config.ts
README.md
```

### Server

```
server/
	.DS_Store
	.env
	.gitignore
	apikey.json
	connection.js
	index.js
	models/
		Clips.js
	package.json
	README.md
	routes/
		ClipRoute.js
```

## Key Files

### Client

- [`src/App.tsx`](command:_github.copilot.openSymbolInFile?%5B%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fhome%2Fkumar%2FDesktop%2FOnlineClipboard%2Fclient%2Fsrc%2FApp.tsx%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22src%2FApp.tsx%22%5D "/home/kumar/Desktop/OnlineClipboard/client/src/App.tsx"): Main application component.
- [`src/Home/Home.tsx`](command:_github.copilot.openSymbolInFile?%5B%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fhome%2Fkumar%2FDesktop%2FOnlineClipboard%2Fclient%2Fsrc%2FHome%2FHome.tsx%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22src%2FHome%2FHome.tsx%22%5D "/home/kumar/Desktop/OnlineClipboard/client/src/Home/Home.tsx"): Handles file upload, file retrieval, and clipboard operations.
- [`src/Config.tsx`](command:_github.copilot.openSymbolInFile?%5B%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fhome%2Fkumar%2FDesktop%2FOnlineClipboard%2Fclient%2Fsrc%2FConfig.tsx%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22src%2FConfig.tsx%22%5D "/home/kumar/Desktop/OnlineClipboard/client/src/Config.tsx"): Configuration settings for the application.

### Server

- [`index.js`](command:_github.copilot.openSymbolInFile?%5B%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fhome%2Fkumar%2FDesktop%2FOnlineClipboard%2Fserver%2Findex.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22index.js%22%5D "/home/kumar/Desktop/OnlineClipboard/server/index.js"): Main entry point of the application. Sets up the Express server, applies middleware, and includes the routes from [`routes/ClipRoute.js`](command:_github.copilot.openSymbolInFile?%5B%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fhome%2Fkumar%2FDesktop%2FOnlineClipboard%2Fserver%2Froutes%2FClipRoute.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22routes%2FClipRoute.js%22%5D "/home/kumar/Desktop/OnlineClipboard/server/routes/ClipRoute.js").
- [`connection.js`](command:_github.copilot.openSymbolInFile?%5B%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fhome%2Fkumar%2FDesktop%2FOnlineClipboard%2Fserver%2Fconnection.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22connection.js%22%5D "/home/kumar/Desktop/OnlineClipboard/server/connection.js"): Sets up the connection to the database.
- [`models/Clips.js`](command:_github.copilot.openSymbolInFile?%5B%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fhome%2Fkumar%2FDesktop%2FOnlineClipboard%2Fserver%2Fmodels%2FClips.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22models%2FClips.js%22%5D "/home/kumar/Desktop/OnlineClipboard/server/models/Clips.js"): Defines the [`Clips`](command:_github.copilot.openSymbolFromReferences?%5B%22Clips%22%2C%5B%7B%22uri%22%3A%7B%22%24mid%22%3A1%2C%22fsPath%22%3A%22%2Fhome%2Fkumar%2FDesktop%2FOnlineClipboard%2Fserver%2FREADME.md%22%2C%22external%22%3A%22file%3A%2F%2F%2Fhome%2Fkumar%2FDesktop%2FOnlineClipboard%2Fserver%2FREADME.md%22%2C%22path%22%3A%22%2Fhome%2Fkumar%2FDesktop%2FOnlineClipboard%2Fserver%2FREADME.md%22%2C%22scheme%22%3A%22file%22%7D%2C%22pos%22%3A%7B%22line%22%3A12%2C%22character%22%3A1%7D%7D%5D%5D "Go to definition") model used in the application.
- [`routes/ClipRoute.js`](command:_github.copilot.openSymbolInFile?%5B%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fhome%2Fkumar%2FDesktop%2FOnlineClipboard%2Fserver%2Froutes%2FClipRoute.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22routes%2FClipRoute.js%22%5D "/home/kumar/Desktop/OnlineClipboard/server/routes/ClipRoute.js"): Contains the routes for saving text, uploading files, and retrieving saved text or files.

## API Endpoints

### POST `/save`

Saves the provided text to the database and returns a unique code. The text will be deleted after the specified time.

Request body:
```json
{
  "text": "string",
  "time": "string"
}
```

Response:
```json
{
  "message": "Saved",
  "code": "string"
}
```

### POST `/upload`

Uploads a file to Google Drive and saves the file ID to the database. The file will be deleted from Google Drive and the database after the specified time.

Request body:
```json
{
  "file": "file",
  "time": "string"
}
```

Response:
```json
{
  "message": "Saved",
  "code": "string"
}
```

### GET `/show`

Retrieves the saved text or file ID associated with the provided code.

Request headers:
```json
{
  "code": "string"
}
```

Response:
```json
{
  "text": "string"
}
```
or
```json
{
  "fileId": "string"
}
```

## Running the Project

To run the project, use the following commands:

### Client

```sh
cd client
npm install
npm run dev
```

### Server

```sh
cd server
npm install
node index.js
```

This will start the client development server and the backend server.

## Building the Project

To build the client project, run the [`build`](command:_github.copilot.openSymbolFromReferences?%5B%22build%22%2C%5B%7B%22uri%22%3A%7B%22%24mid%22%3A1%2C%22fsPath%22%3A%22%2Fhome%2Fkumar%2FDesktop%2FOnlineClipboard%2Fclient%2FREADME.md%22%2C%22external%22%3A%22file%3A%2F%2F%2Fhome%2Fkumar%2FDesktop%2FOnlineClipboard%2Fclient%2FREADME.md%22%2C%22path%22%3A%22%2Fhome%2Fkumar%2FDesktop%2FOnlineClipboard%2Fclient%2FREADME.md%22%2C%22scheme%22%3A%22file%22%7D%2C%22pos%22%3A%7B%22line%22%3A21%2C%22character%22%3A3%7D%7D%5D%5D "Go to definition") script in the [`package.json`](command:_github.copilot.openSymbolInFile?%5B%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fhome%2Fkumar%2FDesktop%2FOnlineClipboard%2Fclient%2Fpackage.json%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22package.json%22%5D "/home/kumar/Desktop/OnlineClipboard/client/package.json") file:

```sh
npm run build
```

## Linting

To lint the client project, run the [`lint`](command:_github.copilot.openSymbolFromReferences?%5B%22lint%22%2C%5B%7B%22uri%22%3A%7B%22%24mid%22%3A1%2C%22fsPath%22%3A%22%2Fhome%2Fkumar%2FDesktop%2FOnlineClipboard%2Fclient%2FREADME.md%22%2C%22external%22%3A%22file%3A%2F%2F%2Fhome%2Fkumar%2FDesktop%2FOnlineClipboard%2Fclient%2FREADME.md%22%2C%22path%22%3A%22%2Fhome%2Fkumar%2FDesktop%2FOnlineClipboard%2Fclient%2FREADME.md%22%2C%22scheme%22%3A%22file%22%7D%2C%22pos%22%3A%7B%22line%22%3A29%2C%22character%22%3A3%7D%7D%5D%5D "Go to definition") script in the [`package.json`](command:_github.copilot.openSymbolInFile?%5B%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fhome%2Fkumar%2FDesktop%2FOnlineClipboard%2Fclient%2Fpackage.json%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22package.json%22%5D "/home/kumar/Desktop/OnlineClipboard/client/package.json") file:

```sh
npm run lint
```

## Previewing the Build

To preview the client build, run the [`preview`](command:_github.copilot.openSymbolFromReferences?%5B%22preview%22%2C%5B%7B%22uri%22%3A%7B%22%24mid%22%3A1%2C%22fsPath%22%3A%22%2Fhome%2Fkumar%2FDesktop%2FOnlineClipboard%2Fclient%2FREADME.md%22%2C%22external%22%3A%22file%3A%2F%2F%2Fhome%2Fkumar%2FDesktop%2FOnlineClipboard%2Fclient%2FREADME.md%22%2C%22path%22%3A%22%2Fhome%2Fkumar%2FDesktop%2FOnlineClipboard%2Fclient%2FREADME.md%22%2C%22scheme%22%3A%22file%22%7D%2C%22pos%22%3A%7B%22line%22%3A37%2C%22character%22%3A3%7D%7D%5D%5D "Go to definition") script in the [`package.json`](command:_github.copilot.openSymbolInFile?%5B%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fhome%2Fkumar%2FDesktop%2FOnlineClipboard%2Fclient%2Fpackage.json%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22package.json%22%5D "/home/kumar/Desktop/OnlineClipboard/client/package.json") file:

```sh
npm run preview
```

## Contributing

Contributions are welcome. Please open an issue first to discuss what you would like to change.

## Author
Name: Kumar Devashish

Email ID: kumardevashish000@gmail.com

## License

This project is licensed under the terms of the MIT license.
```