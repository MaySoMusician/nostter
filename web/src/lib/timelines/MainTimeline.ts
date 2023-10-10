import { get } from 'svelte/store';
import type { Event } from 'nostr-typedef';
import { batch, createRxBackwardReq, createRxNostr, latestEach } from 'rx-nostr';
import { bufferTime } from 'rxjs';
import { timeout } from '$lib/Constants';
import { filterTags } from '$lib/EventHelper';
import { Metadata } from '$lib/Items';
import { metadataStore } from '../cache/Events';

export const rxNostr = createRxNostr({ timeout }); // Based on NIP-65

const metadataReq = createRxBackwardReq();

export function metadataReqEmit(event: Event): void {
	for (const pubkey of [event.pubkey, ...filterTags('p', event.tags)]) {
		console.debug('[rx-nostr metadata REQ emit]', pubkey);
		metadataReq.emit({
			kinds: [0],
			authors: [pubkey],
			limit: 1
		});
	}
}

rxNostr
	.use(metadataReq.pipe(bufferTime(1000, null, 10), batch()))
	.pipe(latestEach(({ event }: { event: Event }) => event.pubkey))
	.subscribe(async (packet) => {
		const cache = get(metadataStore).get(packet.event.pubkey);
		if (cache === undefined || cache.event.created_at < packet.event.created_at) {
			const metadata = new Metadata(packet.event);
			console.log('[rx-nostr metadata]', packet, metadata.content?.name);
			const store = get(metadataStore);
			store.set(metadata.event.pubkey, metadata);
			metadataStore.set(store);
		}
	});
