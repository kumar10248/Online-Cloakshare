# Clipnet

## Overview
This project is a clipboard application that allows users to save text or upload files temporarily. The saved text or uploaded files are accessible via a unique code and can be set to be automatically deleted after a specified time.

## Project Structure
```
.gitignore
apikey.json
connection.js
index.js
models/
	Clips.js
package.json
routes/
	ClipRoute.js
```

## Key Files

### [`index.js`](command:_github.copilot.openSymbolInFile?%5B%22index.js%22%2C%22index.js%22%5D "index.js")
This is the main entry point of the application. It sets up the Express server, applies middleware, and includes the routes from [`[`ClipRoute.js`](command:_github.copilot.openSymbolInFile?%5B%22index.js%22%2C%22ClipRoute.js%22%5D "index.js")`](command:_github.copilot.openRelativePath?%5B%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2FUsers%2Fraushan%2FDocuments%2FCode%2Fclipboard%2Fclipboard-backend%2Froutes%2FClipRoute.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%5D "/Users/raushan/Documents/Code/clipboard/clipboard-backend/routes/ClipRoute.js").

### [`connection.js`](command:_github.copilot.openSymbolInFile?%5B%22connection.js%22%2C%22connection.js%22%5D "connection.js")
This file sets up the connection to the database.

### [`models/Clips.js`](command:_github.copilot.openSymbolInFile?%5B%22models%2FClips.js%22%2C%22models%2FClips.js%22%5D "models/Clips.js")
This file defines the [`Clips`](command:_github.copilot.openSymbolInFile?%5B%22routes%2FClipRoute.js%22%2C%22Clips%22%5D "routes/ClipRoute.js") model used in the application.

### [`routes/ClipRoute.js`](command:_github.copilot.openSymbolInFile?%5B%22routes%2FClipRoute.js%22%2C%22routes%2FClipRoute.js%22%5D "routes/ClipRoute.js")
This file contains the routes for the application. It includes routes for saving text, uploading files, and retrieving saved text or files.

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

### POST [`/upload`](command:_github.copilot.openSymbolInFile?%5B%22routes%2FClipRoute.js%22%2C%22%2Fupload%22%5D "routes/ClipRoute.js")
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
To run the project, use the following command:

```sh
node index.js
```

This will start the server on port 8000, or the port specified in the [`PORT`](command:_github.copilot.openSymbolInFile?%5B%22index.js%22%2C%22PORT%22%5D "index.js") environment variable.