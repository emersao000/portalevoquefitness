import socketio
import asyncio
import threading
import concurrent.futures
from typing import Optional

# Single Socket.IO server instance for the whole app
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")

# Global event loop for async operations from sync context
_event_loop: Optional[asyncio.AbstractEventLoop] = None


def set_event_loop(loop: asyncio.AbstractEventLoop):
    """Set the event loop for sync-to-async bridge"""
    global _event_loop
    _event_loop = loop


def mount_socketio(app):
    """Wrap FastAPI app with Socket.IO ASGI app.
    Returns an ASGI application that serves both HTTP and Socket.IO.
    """
    # Expose Socket.IO under /socket.io (standard path for compatibility)
    return socketio.ASGIApp(sio, other_asgi_app=app, socketio_path="socket.io")


# Lightweight handlers: clients should emit 'identify' with { user_id }
# so server can add the socket to a dedicated room 'user:{id}'.
@sio.event
async def connect(sid, environ):
    print(f"[SIO] connect: {sid}")


@sio.event
async def disconnect(sid):
    print(f"[SIO] disconnect: {sid}")


@sio.on("identify")
async def handle_identify(sid, data):
    try:
        uid = data.get("user_id") if isinstance(data, dict) else None
        if uid is None:
            return
        room = f"user:{uid}"
        await sio.save_session(sid, {"user_id": uid})
        await sio.enter_room(sid, room)
        print(f"[SIO] sid={sid} joined room={room}")
    except Exception as e:
        print(f"[SIO] identify error: {e}")


async def emit_logout_for_user(user_id: int):
    """Helper to emit logout event to a user's room."""
    try:
        room = f"user:{user_id}"
        print(f"[SIO] emitting auth:logout to room={room}")
        await sio.emit("auth:logout", {"user_id": user_id}, room=room)
    except Exception as e:
        print(f"[SIO] emit_logout error: {e}")


async def emit_refresh_for_user(user_id: int):
    """Notify a specific user that their permissions/profile changed."""
    try:
        room = f"user:{user_id}"
        print(f"[SIO] emitting auth:refresh to room={room}")
        await sio.emit("auth:refresh", {"user_id": user_id}, room=room)
    except Exception as e:
        print(f"[SIO] emit_refresh error: {e}")


# Synchronous wrapper that can be safely passed to start_background_task from any thread.
def emit_logout_sync(user_id: int):
    """Emit logout event to user's room (thread-safe)."""
    try:
        room = f"user:{user_id}"
        print(f"[SIO] emit_logout_sync: emitting auth:logout to room={room}")
        _emit_event_from_sync("auth:logout", {"user_id": user_id}, room)
        print(f"[SIO] emit_logout_sync completed for user_id={user_id}")
    except Exception as e:
        print(f"[SIO] emit_logout_sync error for user_id={user_id}: {e}")
        import traceback
        traceback.print_exc()


def emit_refresh_sync(user_id: int):
    """Emit refresh event to user's room (thread-safe)."""
    try:
        room = f"user:{user_id}"
        print(f"[SIO] emit_refresh_sync: emitting auth:refresh to room={room}")
        _emit_event_from_sync("auth:refresh", {"user_id": user_id}, room)
        print(f"[SIO] emit_refresh_sync completed for user_id={user_id}")
    except Exception as e:
        print(f"[SIO] emit_refresh_sync error for user_id={user_id}: {e}")
        import traceback
        traceback.print_exc()


def _emit_event_from_sync(event: str, data: dict, room: str):
    """Bridge to emit Socket.IO events from sync context."""
    global _event_loop

    async def _do_emit():
        try:
            print(f"[SIO] _do_emit: sending {event} to room {room}")
            await sio.emit(event, data, room=room)
            print(f"[SIO] _do_emit: {event} sent successfully to room {room}")
        except Exception as e:
            print(f"[SIO] _do_emit error: {e}")
            import traceback
            traceback.print_exc()

    # Try to use running loop or create a new task
    try:
        if _event_loop and not _event_loop.is_closed():
            # Schedule on the existing loop
            future = asyncio.run_coroutine_threadsafe(_do_emit(), _event_loop)
            # Wait with a timeout
            future.result(timeout=2.0)
            print(f"[SIO] Event scheduled successfully on existing loop")
        else:
            print(f"[SIO] No event loop available, attempting direct approach")
            # Fallback: try to run in a new thread's event loop
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(_do_emit())
            finally:
                loop.close()
    except concurrent.futures.TimeoutError:
        print(f"[SIO] Timeout waiting for event to be emitted")
    except Exception as e:
        print(f"[SIO] Error scheduling event: {e}")
        import traceback
        traceback.print_exc()
