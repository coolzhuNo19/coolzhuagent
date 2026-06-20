# 2026-05-10 - SQLite 分页检索 (TDD)

## 背景
当前架构：SessionStore 在启动时从 SQLite 全量加载消息/beads 到内存 Vec，查询走内存切片。
问题：消息量大时内存占用高，无真正的分页查询。

## TDD 流程

### RED 阶段
新增 4 个测试用例，使用临时 SQLite DB 插入已知数据并验证分页查询：

| 测试用例 | 覆盖范围 |
|---------|---------|
| `sqlite_session_messages_paginated_offset_limit` | OFFSET/LIMIT 分页、total 计数、has_more 判定 |
| `sqlite_chat_room_messages_paginated` | chat_room_messages 表分页 |
| `sqlite_memory_beads_paginated` | memory_beads 表分页，pinned DESC 排序 |
| `sqlite_message_search_fts` | LIKE 搜索 + 特殊字符转义 |

### GREEN 阶段
新增 5 个函数（`main.rs:10322-10476`）：

| 函数 | 功能 |
|------|------|
| `query_session_messages_sqlite(conn, sid, limit, offset)` | session_messages 分页查询 |
| `query_chat_room_messages_sqlite(conn, rid, limit, offset)` | chat_room_messages 分页查询 |
| `query_memory_beads_sqlite(conn, sid, limit, offset)` | memory_beads 分页查询 |
| `search_session_messages_sqlite(conn, sid, q, limit, offset)` | LIKE 全文搜索 |
| `SqliteMessagePage` / `SqliteBeadPage` | 分页结果结构体 |

特性：
- COUNT(*) 获取总量
- ORDER BY + LIMIT + OFFSET 分页
- has_more = (offset + limit < total)
- LIKE 特殊字符 '%' / '_' 转义

## 测试结果
- **新增**: 4 passed, 0 failed
- **全量**: 142 passed, 0 failed

## 下一步
- 将新函数集成到 `SessionStore` API 替换内存切片
- 添加排序参数（created_at ASC/DESC）
- 添加全文索引（FTS5）

## 备份
- `tmp/backups/sqlite-pagination-20260510-185834/`
