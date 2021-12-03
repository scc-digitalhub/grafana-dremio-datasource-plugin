# Dremio Data Source Plugin for Grafana

This is a Grafana data source plugin for connecting to Dremio. It is based on the [data source plugin template](https://grafana.com/tutorials/build-a-data-source-plugin/) created with [grafana-toolkit](https://github.com/grafana/grafana/tree/main/packages/grafana-toolkit).

The plugin is just frontend and interacts with Dremio REST API. Its requests are proxied through the Grafana server.

## Getting Started

**NOTE**: in order to use the plugin out of the box, you need make sure your Grafana is configured to accept [unsigned](https://grafana.com/docs/grafana/latest/plugins/plugin-signatures/) plugins.

1. Clone the plugin repository inside your Grafana [plugin directory](https://grafana.com/docs/grafana/latest/administration/configuration/#plugins):

   ```
   git clone https://github.com/scc-digitalhub/dremio-datasource-plugin.git
   ```

2. Install the dependencies:

   ```
   cd dremio-datasource-plugin
   yarn install
   ```

3. Build the plugin in development mode:

   ```
   yarn dev
   ```

   or run in watch mode:

   ```
   yarn watch
   ```
   
   or build in production mode:

   ```
   yarn build
   ```

4. Restart Grafana.
