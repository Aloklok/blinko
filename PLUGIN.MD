> ## Documentation Index
> Fetch the complete documentation index at: https://docs.blinko.space/llms.txt
> Use this file to discover all available pages before exploring further.

# Publishing Your Plugin

> When your plugin is ready for release, you can publish it to the Blinko Plugin Marketplace. This guide will walk you through the process of preparing and publishing your plugin.

## Prerequisites

Before publishing, ensure you have:

* A complete and tested plugin
* A public GitHub repository
* A valid GitHub account
* Github Cli installed [Github Cli](https://cli.github.com/)

## Publishing Process

### 1. Prepare Your Plugin

Before publishing, make sure your plugin meets all requirements:

1. Update your `plugin.json` with the latest version number

2. Ensure all required fields in `plugin.json` are filled:
   ```json  theme={null}
   {
     "name": "your-plugin-name",
     "author": "your-name",
     "url": "https://github.com/your-username/your-plugin",
     "version": "1.0.0",
     "minAppVersion": "0.0.0",
     "displayName": {
       "default": "Your Plugin Name",
       "zh": "你的插件名称"
     },
     "description": {
       "default": "Your plugin description",
       "zh": "你的插件描述"
     }
   }
   ```

3. Test your plugin thoroughly

4. Commit and push all changes to GitHub

### 2. Run the Publish Command

The template provides a simple command to handle the release process:

```bash  theme={null}
bun release:publish
```

This command will:

1. Build your plugin for production
2. Create a release package (`release.zip`)
3. Create a GitHub release with the package
4. Submit your plugin to the [Blinko Plugin Marketplace](https://github.com/blinko-space/blinko-plugin-marketplace)

### 3. Behind the Scenes

The `release:publish` command uses [blinko-cli](https://github.com/blinko-space/blinko-cli) to handle the release process. Here's what happens:

1. The CLI validates your `plugin.json` and ensures all required fields are present
2. It packages your plugin's `release` directory into a ZIP file
3. Using GitHub's API, it creates a new release with your version number
4. The release package is uploaded to the GitHub release
5. An issue is created in the Blinko Plugin Marketplace repository to request publication

### 4. After Publishing

After running the publish command:

1. A new issue will be created in the [Blinko Plugin Marketplace](https://github.com/blinko-space/blinko-plugin-marketplace)
2. The Blinko team will review your plugin
3. Once approved, your plugin will be available in the marketplace

<img className="rounded-2xl" src="https://mintcdn.com/blinko/AgHVAkfwbrWVbQ0E/images/2025-02-20-16-14-16.png?fit=max&auto=format&n=AgHVAkfwbrWVbQ0E&q=85&s=a7a838dec0b2bb21e94f7a43129c6e68" data-og-width="1671" width="1671" data-og-height="476" height="476" data-path="images/2025-02-20-16-14-16.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/blinko/AgHVAkfwbrWVbQ0E/images/2025-02-20-16-14-16.png?w=280&fit=max&auto=format&n=AgHVAkfwbrWVbQ0E&q=85&s=004c228f14743d02fc79ac2b3a2cf878 280w, https://mintcdn.com/blinko/AgHVAkfwbrWVbQ0E/images/2025-02-20-16-14-16.png?w=560&fit=max&auto=format&n=AgHVAkfwbrWVbQ0E&q=85&s=7caa019c126236d949f8f8f78be54f7e 560w, https://mintcdn.com/blinko/AgHVAkfwbrWVbQ0E/images/2025-02-20-16-14-16.png?w=840&fit=max&auto=format&n=AgHVAkfwbrWVbQ0E&q=85&s=1cbc4b09c066d5e352f69acfcaee3f93 840w, https://mintcdn.com/blinko/AgHVAkfwbrWVbQ0E/images/2025-02-20-16-14-16.png?w=1100&fit=max&auto=format&n=AgHVAkfwbrWVbQ0E&q=85&s=e1af21d0e82d36e3aae448feaea45498 1100w, https://mintcdn.com/blinko/AgHVAkfwbrWVbQ0E/images/2025-02-20-16-14-16.png?w=1650&fit=max&auto=format&n=AgHVAkfwbrWVbQ0E&q=85&s=76d5546aeb2081692a2ba5cb9a58de87 1650w, https://mintcdn.com/blinko/AgHVAkfwbrWVbQ0E/images/2025-02-20-16-14-16.png?w=2500&fit=max&auto=format&n=AgHVAkfwbrWVbQ0E&q=85&s=b4c3fef9fe2905c3f8300b5d511e0bc2 2500w" />

4. You can track the status of your submission through the GitHub issue

## Troubleshooting

### Common Issues

1. GitHub Authentication
   * Ensure you have proper GitHub credentials configured
   * Check your repository permissions

2. Version Number Issues
   * Make sure your version follows semantic versioning (e.g., 1.0.0)
   * Version number must be higher than previous releases

3. Release Package Problems
   * Verify your release directory contains all necessary files
   * Check that the ZIP file was created successfully

4. Repository Access
   * Confirm your repository is public
   * Verify the repository URL in `plugin.json` is correct

## Need Help?

If you encounter any issues or need assistance:

* Check our [community forums](/en/community/community)
* Open an issue in the [blinko-cli repository](https://github.com/blinko-space/blinko-cli)
* Review existing issues in the [marketplace repository](https://github.com/blinko-space/blinko-plugin-marketplace)


> ## Documentation Index
> Fetch the complete documentation index at: https://docs.blinko.space/llms.txt
> Use this file to discover all available pages before exploring further.

# Plugin API Reference

> Complete reference for Blinko Plugin API

## Global API

Blinko exposes a global API through the `window.Blinko` object:

```typescript  theme={null}
interface Window {
  Blinko: {
    // Core APIs
    api: typeof api;              // TRPC API client
    eventBus: typeof eventBus;    // Event system
    i18n: typeof i18n;           // Internationalization
    version: string;             // Blinko version
    toast: ToastPlugin;          // Toast notifications
    
    // Store Access
    store: {
      StorageState: typeof StorageState;
      PromiseState: typeof PromiseState;
      PromisePageState: typeof PromisePageState;
      blinkoStore: BlinkoStore;
      baseStore: BaseStore;
      hubStore: HubStore;
      resourceStore: ResourceStore;
    };
    
    // Utility Functions
    globalRefresh: () => void;    // Refresh application
  } & PluginApiStore;  // Plugin API methods
}
```

## Store

`window.Blinko.store`

The store provides a set of methods and interfaces for extending Blinko's functionality [Store](/plugins/store).

## Plugin API Store

`window.Blinko.api`

For detailed API documentation, including all available endpoints and methods, please refer to the [official Blinko API documentation](https://api.blinko.space/reference).

### Toolbar Icons

`window.Blinko.addToolBarIcon`

Add custom icons to the toolbar with tooltips and click actions.

```typescript  theme={null}
type ToolbarIcon = {
  name: string;          // Unique identifier for the icon
  icon: string;          // Icon name or URL
  tooltip: string;       // Tooltip text shown on hover
  content: () => HTMLElement;  // Content to show when clicked
  placement?: 'top' | 'bottom' | 'left' | 'right';  // Tooltip placement
  maxWidth?: number;     // Maximum width of the content
};

// Example usage
window.Blinko.addToolBarIcon({
  name: 'my-custom-tool',
  icon: 'settings',
  tooltip: 'My Custom Tool',
  content: () => {
    const div = document.createElement('div');
    div.innerHTML = 'Custom tool content';
    return div;
  },
  placement: 'bottom',
  maxWidth: 300
});
```

### Right-Click Menu

`window.Blinko.addRightClickMenu`

Add custom items to the note right-click context menu.

```typescript  theme={null}
type RightClickMenu = {
  name: string;          // Unique identifier for the menu item
  label: string;         // Display text
  icon?: string;         // Optional icon
  onClick: (note: Note) => void;  // Click handler
  disabled?: boolean;    // Whether the item is disabled
};

// Example usage
window.Blinko.addRightClickMenu({
  name: 'my-menu-item',
  label: 'My Custom Action',
  icon: 'star',
  onClick: (note) => {
    console.log('Clicked on note:', note);
  }
});
```

### Custom Dialogs

`window.Blinko.showDialog`

Show custom dialog windows with your content.

```typescript  theme={null}
type DialogOptions = {
  title: string;         // Dialog title
  content: () => HTMLElement;  // Dialog content
};

// Example usage
window.Blinko.showDialog({
  title: 'My Custom Dialog',
  content: () => {
    const div = document.createElement('div');
    div.innerHTML = 'Custom dialog content';
    return div;
  }
});

// Close the dialog
window.Blinko.closeDialog();
```

### AI Writing Prompts

`window.Blinko.addAiWritePrompt`
Add custom AI writing prompts to the AI writing feature.

```typescript  theme={null}
// Add a custom AI writing prompt
window.Blinko.addAiWritePrompt(
  'My Custom Prompt',    // Name
  'Write about...',      // Prompt text
  'magic-wand'           // Optional icon
);
```

## Type Definitions

For detailed type information, you can refer to the [type definitions on GitHub](https://github.com/blinko-space/blinko/tree/main/types).


Skip to main content
Blinko home pagedark logo

US
English
Guides
Blogs
Plugins
Demo Site
blinko-space/blinko
9,364
Search...

API Documentation
Getting Started
Get Started
Publishing Your Plugin
Plugin API Reference
Store System
Plugin Settings Panel
Getting Started
Store System
Blinko provides a powerful store system for state management. You can access it through window.Blinko.store.

​
Store Structure
interface Window {
  Blinko: {
    store: {
      // Base Store Types
      StorageState: typeof StorageState;        // Persistent storage state
      PromiseState: typeof PromiseState;        // Async operation state
      PromisePageState: typeof PromisePageState;  // Paginated async state
      
      // Store Instances
      blinkoStore: BlinkoStore;    // Core functionality store
      baseStore: BaseStore;        // Base application store
      hubStore: HubStore;          // Sync and connection store
      resourceStore: ResourceStore; // Resource management store
    }
  }
}
​
Base Store Types
​
StorageState
For managing persistent state with subscription support.
class StorageState<T> {
  // Get current value
  get(): T;
  
  // Update value
  set(value: T): void;
  
  // Subscribe to changes
  subscribe(callback: (value: T) => void): () => void;
}

// Example usage
const settings = window.Blinko.store.blinkoStore.settings;
settings.subscribe((newSettings) => {
  console.log('Settings changed:', newSettings);
});
​
Store Instances
​
BlinkoStore
Core functionality store for notes, tags, and settings.
interface BlinkoStore {
  notes: {
    list: PromisePageState<Note[]>;
    detail: PromiseState<Note>;
    // ... other note operations
  };
  tags: {
    list: PromiseState<Tag[]>;
    // ... tag operations
  };
  settings: StorageState<Settings>;
  // ... other core features
}
​
BaseStore
Base application store for fundamental operations.
interface BaseStore {
  // Application state
  initialized: boolean;
  loading: boolean;
  
  // User session
  session: StorageState<Session>;
  
  // Core operations
  initialize(): Promise<void>;
  reset(): Promise<void>;
}
​
HubStore
Manages synchronization and connections.
interface HubStore {
  // Connection state
  connected: boolean;
  connecting: boolean;
  
  // Sync operations
  sync(): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}
​
ResourceStore
Handles file and resource management.
interface ResourceStore {
  // Resource operations
  upload(file: File): Promise<string>;
  download(url: string): Promise<Blob>;
  delete(url: string): Promise<void>;
  
  // Resource information
  getInfo(url: string): Promise<ResourceInfo>;
  list(): Promise<ResourceInfo[]>;
}
Plugin API Reference
Plugin Settings Panel
Ask a question...

github
Powered by
Store System - Blinko

Skip to main content
Blinko home pagedark logo

US
English
Guides
Blogs
Plugins
Demo Site
blinko-space/blinko
9,364
Search...

API Documentation
Getting Started
Get Started
Publishing Your Plugin
Plugin API Reference
Store System
Plugin Settings Panel
Getting Started
Plugin Settings Panel
Each Blinko plugin can have its own settings panel that allows users to customize the plugins behavior.

​
Plugin Settings Panel

​
Enable Settings Panel
Set withSettingPanel = true in your plugin class to enable the settings panel:
export class MyPlugin extends BasePlugin {
  // Enable settings panel
  withSettingPanel = true;

  // Render settings panel
  renderSettingPanel = () => {
    const container = document.createElement('div');
    render(<Setting />, container);
    return container;
  };
}
​
Create Settings Component
Create a standalone Preact component to manage the settings interface:
// src/setting.tsx
import { useState, useEffect } from 'preact/hooks';
import type { JSXInternal } from 'preact/src/jsx';

/**
 * Setting component for plugin configuration
 * Handles API token and notification settings
 */
export function Setting(): JSXInternal.Element {
  const [apiToken, setApiToken] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const i18n = window.Blinko.i18n;

  // Fetch initial plugin configuration on component mount
  useEffect(() => {
    window.Blinko.api.config.getPluginConfig.query({
      pluginName: 'my-note-plugin'
    }).then((res: any) => {
      setApiToken(res.apiToken)
    })
  }, []);

  /**
   * Handles saving of plugin settings
   * Saves API token and closes settings panel
   */
  const handleSave = async () => {
    window.Blinko.toast.success(i18n.t('settingsSaved'));
    window.Blinko.closeDialog();
    await window.Blinko.api.config.setPluginConfig.mutate({
      pluginName: 'my-note-plugin',
      key: 'apiToken',
      value: apiToken
    });
    window.Blinko.api.config.getPluginConfig.query({
      pluginName: 'my-note-plugin'
    });
  };

  return (
    <div class="max-w-2xl mx-auto p-2 rounded-lg">
      {/* API Token Input Section */}
      <div class="mb-6">
        <label class="block text-sm font-medium mb-2">
          {i18n.t('apiTokenLabel')}
          <input
            value={apiToken}
            onChange={(e) => setApiToken(e.currentTarget.value)}
            placeholder={i18n.t('enterApiToken')}
            class="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm sm:text-sm bg-primary!"
          />
        </label>
      </div>

      {/* Notification Settings Section */}
      <div class="mb-6">
        <label class="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={notificationsEnabled}
            onChange={(e) => setNotificationsEnabled(e.currentTarget.checked)}
            class="h-4 w-4 text-primary-foreground bg-primary rounded"
          />
          <span class="text-sm text-desc">{i18n.t('enableNotifications')}</span>
        </label>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md bg-primary text-primary-foreground"
      >
        {i18n.t('saveSettings')}
      </button>
    </div>
  );
}
​
Configuration API
Blinko provides a configuration API to save and retrieve plugin settings:
interface ConfigAPI {
  getPluginConfig: {
    query: (params: { pluginName: string }) => Promise<any>;
  };
  setPluginConfig: {
    mutate: (params: { 
      pluginName: string;
      key: string;
      value: any;
    }) => Promise<void>;
  };
}
​
Using Configuration in Your Plugin
You can access and use these settings in other parts of your plugin:
export class MyPlugin extends BasePlugin {
  private pluginName = 'my-note-plugin';

  async init() {
    // Load configuration
    const config = await window.Blinko.api.config.getPluginConfig.query({
      pluginName: this.pluginName
    });
    
    // Initialize features based on config
    if (config.apiToken) {
      this.initializeAPI(config.apiToken);
    }
  }

  private initializeAPI(apiToken: string) {
    // API initialization logic
  }
}
​
Best Practices
Type Safety
Use TypeScript types for your configuration
Define interfaces for your plugin’s settings
interface PluginConfig {
  apiToken: string;
  notificationsEnabled: boolean;
}

// Type-safe config access
const config = await window.Blinko.api.config.getPluginConfig.query<PluginConfig>({
  pluginName: 'my-note-plugin'
});
Internationalization
Use Blinko’s i18n system for all text
Provide translations for all settings labels
// i18n usage example
const i18n = window.Blinko.i18n;

<label>{i18n.t('settings.apiToken.label')}</label>
<span>{i18n.t('settings.notifications.enable')}</span>
Error Handling
Handle API errors gracefully
Provide user feedback for actions
const handleSave = async () => {
  try {
    await window.Blinko.api.config.setPluginConfig.mutate({
      pluginName: 'my-note-plugin',
      key: 'apiToken',
      value: apiToken
    });
    window.Blinko.toast.success(i18n.t('settings.saved'));
  } catch (error) {
    window.Blinko.toast.error(i18n.t('settings.saveError'));
  }
};
UI/UX Best Practices
Use consistent styling with Blinko’s theme
Provide immediate feedback for user actions
Use appropriate input types and validation
<input
  type="text"
  class="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm"
  pattern="[A-Za-z0-9]+"
  required
  aria-label={i18n.t('settings.apiToken.label')}
/>
export class MyPlugin extends BasePlugin {
  // Enable settings panel
  withSettingPanel = true;

  // Render settings panel
  renderSettingPanel = () => {
    const container = document.createElement('div');
    render(<Setting />, container);
    return container;
  };
}
​
Create Settings Component
Create a standalone Preact component to manage the settings interface:
// src/setting.tsx
import { useState, useEffect } from 'preact/hooks';
import type { JSXInternal } from 'preact/src/jsx';

/**
 * Setting component for plugin configuration
 * Handles API token and notification settings
 */
export function Setting(): JSXInternal.Element {
  const [apiToken, setApiToken] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const i18n = window.Blinko.i18n;

  // Fetch initial plugin configuration on component mount
  useEffect(() => {
    window.Blinko.api.config.getPluginConfig.query({
      pluginName: 'my-note-plugin'
    }).then((res: any) => {
      setApiToken(res.apiToken)
    })
  }, []);

  /**
   * Handles saving of plugin settings
   * Saves API token and closes settings panel
   */
  const handleSave = async () => {
    window.Blinko.toast.success(i18n.t('settingsSaved'));
    window.Blinko.closeDialog();
    await window.Blinko.api.config.setPluginConfig.mutate({
      pluginName: 'my-note-plugin',
      key: 'apiToken',
      value: apiToken
    });
    window.Blinko.api.config.getPluginConfig.query({
      pluginName: 'my-note-plugin'
    });
  };

  return (
    <div class="max-w-2xl mx-auto p-2 rounded-lg">
      {/* API Token Input Section */}
      <div class="mb-6">
        <label class="block text-sm font-medium mb-2">
          {i18n.t('apiTokenLabel')}
          <input
            value={apiToken}
            onChange={(e) => setApiToken(e.currentTarget.value)}
            placeholder={i18n.t('enterApiToken')}
            class="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm sm:text-sm bg-primary!"
          />
        </label>
      </div>

      {/* Notification Settings Section */}
      <div class="mb-6">
        <label class="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={notificationsEnabled}
            onChange={(e) => setNotificationsEnabled(e.currentTarget.checked)}
            class="h-4 w-4 text-primary-foreground bg-primary rounded"
          />
          <span class="text-sm text-desc">{i18n.t('enableNotifications')}</span>
        </label>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md bg-primary text-primary-foreground"
      >
        {i18n.t('saveSettings')}
      </button>
    </div>
  );
}
​
Configuration API
Blinko provides a configuration API to save and retrieve plugin settings:
interface ConfigAPI {
  getPluginConfig: {
    query: (params: { pluginName: string }) => Promise<any>;
  };
  setPluginConfig: {
    mutate: (params: { 
      pluginName: string;
      key: string;
      value: any;
    }) => Promise<void>;
  };
}
​
Using Configuration in Your Plugin
You can access and use these settings in other parts of your plugin:
export class MyPlugin extends BasePlugin {
  private pluginName = 'my-note-plugin';

  async init() {
    // Load configuration
    const config = await window.Blinko.api.config.getPluginConfig.query({
      pluginName: this.pluginName
    });
    
    // Initialize features based on config
    if (config.apiToken) {
      this.initializeAPI(config.apiToken);
    }
  }

  private initializeAPI(apiToken: string) {
    // API initialization logic
  }
}
​
Best Practices
Type Safety
Use TypeScript types for your configuration
Define interfaces for your plugin’s settings
interface PluginConfig {
  apiToken: string;
  notificationsEnabled: boolean;
}

// Type-safe config access
const config = await window.Blinko.api.config.getPluginConfig.query<PluginConfig>({
  pluginName: 'my-note-plugin'
});
Internationalization
Use Blinko’s i18n system for all text
Provide translations for all settings labels
// i18n usage example
const i18n = window.Blinko.i18n;

<label>{i18n.t('settings.apiToken.label')}</label>
<span>{i18n.t('settings.notifications.enable')}</span>
Error Handling
Handle API errors gracefully
Provide user feedback for actions
const handleSave = async () => {
  try {
    await window.Blinko.api.config.setPluginConfig.mutate({
      pluginName: 'my-note-plugin',
      key: 'apiToken',
      value: apiToken
    });
    window.Blinko.toast.success(i18n.t('settings.saved'));
  } catch (error) {
    window.Blinko.toast.error(i18n.t('settings.saveError'));
  }
};
UI/UX Best Practices
Use consistent styling with Blinko’s theme
Provide immediate feedback for user actions
Use appropriate input types and validation
<input
  type="text"
  class="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm"
  pattern="[A-Za-z0-9]+"
  required
  aria-label={i18n.t('settings.apiToken.label')}
/>
Store System
Ask a question...

github
Powered by
Plugin Settings Panel - Blinko