## CI builds

GitHub Actions workflow at `.github/workflows/build.yml` builds artifacts for:
- Zipped web bundle (dist-web.zip)
- Linux: AppImage and Snap
- macOS: dmg and zip
- Windows: nsis and portable

macOS signing/notarization is not configured; builds are unsigned for local testing. To enable signing, set the appropriate Apple ID and certificate secrets and update electron-builder config.

# Sigilweaver

A visual workflow designer application built with Electron, React, Vite, and TypeScript. Similar to Alteryx, this application allows you to create data processing workflows using a drag-and-drop interface.

## Features

- **Visual Workflow Designer**: Drag and drop tools onto a canvas to create workflows
- **Tool Categories**: Organized tools into Favorites, In/Out, Preparation, and Join categories
- **Real-time XML Generation**: Automatically generates XML representation of workflows
- **Loop Detection**: Built-in validation to detect and warn about workflow loops
- **Desktop Application**: Cross-platform desktop app built with Electron

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Development

To run the application in development mode:

```bash
npm run electron:dev
```

This will start both the Vite dev server and the Electron application.

### Building

To build the application for production:

```bash
npm run build
```

## Architecture

### Tech Stack

- **Electron**: Desktop application framework
- **React**: UI library
- **Vite**: Build tool and dev server
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework

### Project Structure

```
src/
├── components/     # React components
├── data/          # Tool definitions and configurations
├── types/         # TypeScript type definitions
├── utils/         # Utility functions (XML generation, etc.)
└── main.tsx       # Application entry point
```

## Workflow XML Format

The application generates XML workflows in the following format:

- **Meta**: Workflow metadata (name, description, author, etc.)
- **Hierarchy**: Nested groups and tools with positioning
- **Edges**: Connections between tools
- **Config**: Tool-specific configuration

See the Notes folder for a complete example of the XML format.

## Available Tools

### In/Out (Green)
- **Input Data**: Read data from files
- **Output Data**: Write data to files

### Preparation (Blue)
- **Filter**: Filter rows based on conditions
- **Select**: Select specific columns
- **Sort**: Sort data by columns

### Join (Purple)
- **Union**: Combine datasets vertically
- **Join**: Join datasets on common keys

## Menu System

The application includes a traditional desktop menu bar with:

- **File**: New, Open, Save, Export XML
- **Edit**: Standard editing operations
- **View**: Display options and developer tools
- **Workflow**: Run and validate workflows

## Contributing

This is an early-stage project. The focus is currently on:

1. UI/UX improvements
2. Additional tool types
3. Enhanced XML generation
4. Workflow execution engine

## License

[Add your license here]
