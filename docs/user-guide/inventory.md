# Inventory

## Build Storage Locations

Use **Locations** to represent physical storage structure in your workshop.

Locations can be hierarchical (for example, area > drawer > bin).  
You can mark a location as:

- assignable (can hold stock directly)
- organizational (structural node)
- archived (no longer active for regular use)

Archived location behavior:

- archived locations cannot be used as source or destination in new stock movements
- if an archived location still has stock, it remains visible in part stock breakdown with an archived marker
- archiving is blocked while a location has non-zero stock; move or adjust stock to zero first

## Record Stock Movements

From the **Parts** screen, open stock actions for a selected part.

OSO currently supports four movement types:

- receipt
- issue
- transfer
- adjustment

For each movement, you enter quantity and optional note, and select source/destination locations when relevant.  
The system then updates current stock based on recorded movement history.
When multiple stock updates for the same part happen at nearly the same time, OSO applies them in a transaction-safe order so stock cannot be driven below zero by race conditions.
