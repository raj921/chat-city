# Twitch reference check

Checked against official documentation on 2026-11-01.

| Subscription | Version | User-token scope | Condition |
| --- | --- | --- | --- |
| `channel.chat.message` | 1 | `user:read:chat` | broadcaster ID + bot user ID |
| `channel.raid` | 1 | none | destination broadcaster ID |
| `channel.channel_points_custom_reward_redemption.add` | 1 | `channel:read:redemptions` | broadcaster ID |
| `channel.subscribe` | 1 | `channel:read:subscriptions` | broadcaster ID |
| `channel.hype_train.begin`, `.progress`, `.end` | 2 | `channel:read:hype_train` | broadcaster ID |

[EventSub subscription types](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/).

This app uses a user access token; its bot user ID must identify that token's user. Using the broadcaster account for both IDs is the simplest single-channel setup. Affiliate/Partner-only event failures log and continue.

Reconnect URLs transfer subscriptions. The client keeps the old socket until the replacement welcomes it, then retires the old socket. Ordinary disconnections reconnect to the original endpoint and resubscribe. Notifications are deduplicated in bounded memory.

[WebSocket lifecycle](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/).

Chat replies use `POST /helix/chat/messages`, `user:write:chat`, `broadcaster_id`, `sender_id`, and a message capped at 500 characters. An HTTP success can still report `is_sent: false`; the client checks that field.

[Send Chat Message](https://dev.twitch.tv/docs/api/reference/#send-chat-message).

The local CLI mock derives `http://localhost:8080/eventsub/subscriptions` from `ws://localhost:8080/ws`, unless explicitly overridden. Mock chat replies are simulated, preventing mock events from posting to Twitch. `TWITCH_CHAT_URL` is available for an explicit chat API test endpoint.
