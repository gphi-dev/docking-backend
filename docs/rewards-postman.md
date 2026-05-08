# Rewards API Postman Requests

Use the backend base URL as `{{base_url}}` and an admin JWT as `{{admin_token}}`.
The `game_id` field is the value from `games.game_id`, not `games.id`.
For `POST /api/rewards`, include the matching `gamesecretkey` when filtering by `game_id`.
`POST /api/rewards/draw` validates with `game_id` and `gamesecretkey`, so it does not require an admin JWT.

Headers for admin-protected requests:

```text
Content-Type: application/json
Authorization: Bearer {{admin_token}}
```

## 1. Create Reward

```text
POST {{base_url}}/api/rewards/create
```

```json
{
  "game_id": 1,
  "picture": "https://example.com/image.jpg",
  "description": "Free coins reward",
  "prize": "100 Coins",
  "holdings": 50,
  "is_active": 1
}
```

## 2. Get All Rewards

```text
POST {{base_url}}/api/rewards
```

```json
{
  "page": 1,
  "limit": 10
}
```

## 3. Get Rewards By Game ID

```text
POST {{base_url}}/api/rewards
```

```json
{
  "game_id": 1,
  "gamesecretkey": "135a9b7d8776e5228250ee5a844cd7cd",
  "is_active": 1,
  "page": 1,
  "limit": 10
}
```

## 4. Draw Rewards

```text
POST {{base_url}}/api/rewards/draw
```

```json
{
  "game_id": 1,
  "gamesecretkey": "135a9b7d8776e5228250ee5a844cd7cd"
}
```

Draw returns all rewards where `is_active = 1`, `holdings != 0`, and `probability > 0`, then decrements each returned reward once.

## 5. Get Reward By ID

```text
GET {{base_url}}/api/rewards/1
```

## 6. Update Reward

```text
PUT {{base_url}}/api/rewards/1
```

```json
{
  "game_id": 1,
  "picture": "https://example.com/updated-image.jpg",
  "description": "Updated reward description",
  "prize": "500 Coins",
  "holdings": 100,
  "is_active": 1
}
```

## 7. Update One Reward Probability

```text
PUT {{base_url}}/api/rewards/1
```

```json
{
  "game_id": 7,
  "is_active": 1,
  "probability": 16.67
}
```

This supports the frontend bulk form when it sends each active reward through `PUT /api/rewards/:id`.
`game_id` and `is_active` may be included only when they are not changing.

## 8. Bulk Update Reward Probabilities

```text
PUT {{base_url}}/api/rewards/probabilities
```

```json
{
  "game_id": 7,
  "rewards": [
    {
      "id": 1,
      "probability": 5.65
    },
    {
      "id": 2,
      "probability": 20.67
    },
    {
      "id": 3,
      "probability": 23.67
    },
    {
      "id": 4,
      "probability": 16.67
    },
    {
      "id": 5,
      "probability": 16.67
    },
    {
      "id": 6,
      "probability": 16.67
    }
  ]
}
```

## 9. Deactivate Reward

```text
PATCH {{base_url}}/api/rewards/1/status
```

```json
{
  "is_active": 0
}
```

## 10. Delete Reward

```text
DELETE {{base_url}}/api/rewards/1
```
