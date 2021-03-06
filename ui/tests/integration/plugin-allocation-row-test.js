import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';
import { startMirage } from 'nomad-ui/initializers/ember-cli-mirage';
import { render, settled } from '@ember/test-helpers';
import { initialize as fragmentSerializerInitializer } from 'nomad-ui/initializers/fragment-serializer';

module('Integration | Component | plugin allocation row', function(hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function() {
    fragmentSerializerInitializer(this.owner);
    this.store = this.owner.lookup('service:store');
    this.server = startMirage();
    this.server.create('node');
  });

  hooks.afterEach(function() {
    this.server.shutdown();
  });

  test('Plugin allocation row immediately fetches the plugin allocation', async function(assert) {
    const plugin = this.server.create('csi-plugin', { id: 'plugin' });
    const storageController = plugin.controllers.models[0];

    const pluginRecord = await this.store.find('plugin', 'csi/plugin');

    this.setProperties({
      plugin: pluginRecord.get('controllers.firstObject'),
    });

    await render(hbs`
      {{plugin-allocation-row pluginAllocation=plugin}}
    `);

    await settled();

    const allocationRequest = this.server.pretender.handledRequests.find(req =>
      req.url.startsWith('/v1/allocation')
    );
    assert.equal(allocationRequest.url, `/v1/allocation/${storageController.allocID}`);
  });

  test('After the plugin allocation row fetches the plugin allocation, allocation stats are fetched', async function(assert) {
    const plugin = this.server.create('csi-plugin', { id: 'plugin' });
    const storageController = plugin.controllers.models[0];

    const pluginRecord = await this.store.find('plugin', 'csi/plugin');

    this.setProperties({
      plugin: pluginRecord.get('controllers.firstObject'),
    });

    await render(hbs`
      {{plugin-allocation-row pluginAllocation=plugin}}
    `);

    await settled();

    const [statsRequest] = this.server.pretender.handledRequests.slice(-1);

    assert.equal(statsRequest.url, `/v1/client/allocation/${storageController.allocID}/stats`);
  });

  test('Setting a new plugin fetches the new plugin allocation', async function(assert) {
    const plugin = this.server.create('csi-plugin', {
      id: 'plugin',
      isMonolith: false,
      controllersExpected: 2,
    });
    const storageController = plugin.controllers.models[0];
    const storageController2 = plugin.controllers.models[1];

    const pluginRecord = await this.store.find('plugin', 'csi/plugin');

    this.setProperties({
      plugin: pluginRecord.get('controllers.firstObject'),
    });

    await render(hbs`
      {{plugin-allocation-row pluginAllocation=plugin}}
    `);

    await settled();

    const allocationRequest = this.server.pretender.handledRequests.find(req =>
      req.url.startsWith('/v1/allocation')
    );

    assert.equal(allocationRequest.url, `/v1/allocation/${storageController.allocID}`);

    this.set('plugin', pluginRecord.get('controllers').toArray()[1]);
    await settled();

    const latestAllocationRequest = this.server.pretender.handledRequests
      .filter(req => req.url.startsWith('/v1/allocation'))
      .reverse()[0];

    assert.equal(latestAllocationRequest.url, `/v1/allocation/${storageController2.allocID}`);
  });
});
