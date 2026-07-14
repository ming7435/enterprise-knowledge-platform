"""
速率限制器单例。

独立成模块以避免 main.py ↔ routers 之间的循环导入。
main.py 和各 router 都从此处导入 limiter，不互相依赖。
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

# 按客户端 IP 计数，使用内存存储（单进程部署足够，多进程需换 Redis backend）
limiter = Limiter(key_func=get_remote_address)
