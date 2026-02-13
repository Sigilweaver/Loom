---
sidebar_position: 5
---

# Sample

Take a subset of rows from your data using various sampling strategies.

## Sockets

| Socket | Direction | Description |
|--------|-----------|-------------|
| `input` | Input | Data to sample from |
| `output` | Output | Sampled rows |

## Sampling Modes

| Mode | Description | Blocking |
|------|-------------|----------|
| **First N** | Take the first N rows | No (streaming) |
| **Last N** | Take the last N rows | Yes |
| **Every N** | Take every Nth row (with optional offset) | No (streaming) |
| **Random** | Take N random rows | Yes |
| **Random Percent** | Take a random percentage of rows | Yes |
| **First Percent** | Take the first N% of rows | Yes |

:::warning Blocking Modes
**Last N**, **Random**, **Random Percent**, and **First Percent** modes require reading all data before producing output. This means the entire dataset must fit in memory.

**First N** and **Every N** are streaming-friendly and work efficiently with large datasets.
:::

## Configuration

| Option | Default | Applies To | Description |
|--------|---------|-----------|-------------|
| Mode | `First N` | All | Sampling strategy to use |
| N | `100` | First N, Last N, Random, Every N | Number of rows (or interval for Every N) |
| Percent | `10.0` | Random Percent, First Percent | Percentage of rows (0-100) |
| Offset | `0` | Every N | Starting row offset |
| Seed | (none) | Random, Random Percent | Random seed for reproducible results |

## Examples

### Take First 1000 Rows

1. Connect data to the Sample tool
2. Set Mode to **First N**
3. Set N to `1000`

### Random 10% Sample

1. Connect data to the Sample tool
2. Set Mode to **Random Percent**
3. Set Percent to `10`
4. Optionally set a Seed for reproducibility

### Every 5th Row

1. Connect data to the Sample tool
2. Set Mode to **Every N**
3. Set N to `5`
4. Set Offset to `0` (start from the first row)

## Notes

- The output schema is always identical to the input schema
- **First N** and **Every N** are the most memory-efficient modes since they don't require loading all data
- Use **Seed** with Random/Random Percent modes to get the same sample each time you run the workflow
- **Every N** with an offset of 2 and N of 3 takes rows 2, 5, 8, 11, etc.
