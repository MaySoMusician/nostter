import { get } from 'svelte/store';
import type { Event } from 'nostr-typedef';
import { batch, createRxBackwardReq, createRxNostr, latestEach } from 'rx-nostr';
import { bufferTime } from 'rxjs';
import { timeout } from '$lib/Constants';
import { filterTags } from '$lib/EventHelper';
import { Metadata } from '../Items';
import { metadataEvents } from '../cache/Events';
import { events } from '../../stores/Events';

export const rxNostr = createRxNostr({ timeout }); // for home & notification timeline
export const metadataReq = createRxBackwardReq();
export function metadataReqEmit(event: Event): void {
	for (const pubkey of [event.pubkey, ...filterTags('p', event.tags)]) {
		metadataReq.emit({
			kinds: [0],
			authors: [pubkey],
			limit: 1
		});
	}
}

const $events = get(events);
rxNostr
	.use(metadataReq.pipe(bufferTime(1000, null, 10), batch()))
	.pipe(latestEach(({ event }: { event: Event }) => event.pubkey))
	.subscribe(async (packet) => {
		const cache = metadataEvents.get(packet.event.pubkey);
		if (cache === undefined || cache.created_at < packet.event.created_at) {
			metadataEvents.set(packet.event.pubkey, packet.event);

			const metadata = new Metadata(packet.event);
			console.log('[rx-nostr metadata]', packet, metadata.content?.name, $events.length);
			for (const item of $events) {
				if (item.event.pubkey !== packet.event.pubkey) {
					continue;
				}
				item.metadata = metadata;
			}
			events.set($events);
		}
	});
