"""Foreground-only Windows-key guard for an explicitly armed test. MIT.

Only LWin/RWin are intercepted. No other key values are retained or emitted.
The hook ends on focus loss, owner exit, stop/process exit, or the 15 min limit.
"""
import ctypes as c
from ctypes import wintypes as w
import json
import queue
import sys
import threading
import time


def main():
    if sys.platform != 'win32' or len(sys.argv) != 3 or sys.argv[1] != '--owner-pid':
        raise ValueError('Windows foreground owner PID required')
    owner = int(sys.argv[2])
    user = c.WinDLL('user32', use_last_error=True)
    kernel = c.WinDLL('kernel32', use_last_error=True)
    ptr = c.c_size_t
    result = c.c_ssize_t
    callback_type = c.WINFUNCTYPE(result, c.c_int, ptr, result)

    class Key(c.Structure):
        _fields_ = [('vk', w.DWORD), ('scan', w.DWORD), ('flags', w.DWORD),
                    ('time', w.DWORD), ('extra', ptr)]

    def signature(dll, name, args, returns):
        fn = getattr(dll, name)
        fn.argtypes, fn.restype = args, returns
        return fn

    foreground = signature(user, 'GetForegroundWindow', [], w.HWND)
    get_pid = signature(user, 'GetWindowThreadProcessId', [w.HWND, c.POINTER(w.DWORD)], w.DWORD)
    hook = signature(user, 'SetWindowsHookExW', [c.c_int, callback_type, w.HINSTANCE, w.DWORD], w.HHOOK)
    unhook = signature(user, 'UnhookWindowsHookEx', [w.HHOOK], w.BOOL)
    next_hook = signature(user, 'CallNextHookEx', [w.HHOOK, c.c_int, ptr, result], result)
    module = signature(kernel, 'GetModuleHandleW', [w.LPCWSTR], w.HMODULE)
    open_process = signature(kernel, 'OpenProcess', [w.DWORD, w.BOOL, w.DWORD], w.HANDLE)
    wait = signature(kernel, 'WaitForSingleObject', [w.HANDLE, w.DWORD], w.DWORD)
    close = signature(kernel, 'CloseHandle', [w.HANDLE], w.BOOL)
    set_timer = signature(user, 'SetTimer', [w.HWND, ptr, w.UINT, c.c_void_p], ptr)
    kill_timer = signature(user, 'KillTimer', [w.HWND, ptr], w.BOOL)
    get_message = signature(user, 'GetMessageW', [c.POINTER(w.MSG), w.HWND, w.UINT, w.UINT], w.BOOL)
    translate = signature(user, 'TranslateMessage', [c.POINTER(w.MSG)], w.BOOL)
    dispatch = signature(user, 'DispatchMessageW', [c.POINTER(w.MSG)], result)

    def owned_foreground():
        pid = w.DWORD()
        get_pid(foreground(), c.byref(pid))
        return pid.value == owner

    if not owned_foreground():
        raise RuntimeError('请先切回设备测试窗口')
    parent = open_process(0x00100000, False, owner)  # SYNCHRONIZE only
    if not parent:
        raise c.WinError(c.get_last_error())
    events = queue.SimpleQueue()

    def output():
        while True:
            event = events.get()
            if event is None:
                return
            try:
                print(json.dumps(event), flush=True)
            except (BrokenPipeError, OSError):
                return

    writer = threading.Thread(target=output, daemon=True)
    writer.start()
    held = set()

    @callback_type
    def receive(code, message, address):
        if code == 0:
            data = c.cast(address, c.POINTER(Key)).contents
            if data.vk in (0x5B, 0x5C) and message in (0x100, 0x101, 0x104, 0x105):
                down = message in (0x100, 0x104)
                if owned_foreground() or (not down and data.vk in held):
                    if down:
                        held.add(data.vk)
                    else:
                        held.discard(data.vk)
                    events.put({'type': 'key', 'code': 'MetaLeft' if data.vk == 0x5B else 'MetaRight',
                                'down': down})
                    return 1
        return next_hook(None, code, message, address)

    handle = None
    timer = 0
    reason = 'stopped'
    try:
        handle = hook(13, receive, module(None), 0)  # WH_KEYBOARD_LL; no DLL/process injection
        if not handle:
            raise c.WinError(c.get_last_error())
        timer = set_timer(None, 0, 100, None)
        if not timer:
            raise c.WinError(c.get_last_error())
        events.put({'type': 'ready', 'scope': 'foreground-windows-keys-only'})
        deadline = time.monotonic() + 900
        message = w.MSG()
        while True:
            status = get_message(c.byref(message), None, 0, 0)
            if status <= 0:
                break
            if message.message == 0x113:
                if not owned_foreground():
                    reason = 'focus-lost'
                    break
                if wait(parent, 0) != 0x102:
                    reason = 'owner-exited'
                    break
                if time.monotonic() >= deadline:
                    reason = 'time-limit'
                    break
            translate(c.byref(message))
            dispatch(c.byref(message))
    finally:
        if handle:
            unhook(handle)
        if timer:
            kill_timer(None, timer)
        close(parent)
        events.put({'type': 'stopped', 'reason': reason})
        events.put(None)
        writer.join(timeout=1)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'type': 'error', 'message': str(error)}, ensure_ascii=True), flush=True)
        raise SystemExit(1)
