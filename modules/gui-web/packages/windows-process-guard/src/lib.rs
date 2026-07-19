//! Small safe boundary around the Windows handle APIs used by Web Console.
//!
//! The rest of the workspace forbids unsafe code. Keeping the Win32 calls in
//! this crate prevents listener handles from leaking to child processes and
//! binds local-model children to the Web Console lifetime.

#![cfg(windows)]

use std::io;
use std::os::windows::io::{AsRawHandle, RawSocket};
use std::process::Child;

use windows_sys::Win32::Foundation::{
    CloseHandle, GetHandleInformation, SetHandleInformation, HANDLE, HANDLE_FLAG_INHERIT,
};
use windows_sys::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
    SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
};

fn socket_as_handle(socket: RawSocket) -> HANDLE {
    socket as usize as HANDLE
}

/// Clear `HANDLE_FLAG_INHERIT` on a socket.
pub fn make_socket_non_inheritable(socket: RawSocket) -> io::Result<()> {
    let result = unsafe { SetHandleInformation(socket_as_handle(socket), HANDLE_FLAG_INHERIT, 0) };
    if result == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

/// Inspect whether a socket currently has `HANDLE_FLAG_INHERIT`.
pub fn socket_is_inheritable(socket: RawSocket) -> io::Result<bool> {
    let mut flags = 0;
    let result = unsafe { GetHandleInformation(socket_as_handle(socket), &mut flags) };
    if result == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(flags & HANDLE_FLAG_INHERIT != 0)
    }
}

/// Job Object configured to terminate all assigned children when its handle closes.
pub struct ChildProcessJob {
    handle: usize,
}

impl ChildProcessJob {
    /// Create a Job Object with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`.
    pub fn new_kill_on_close() -> io::Result<Self> {
        let handle = unsafe { CreateJobObjectW(std::ptr::null(), std::ptr::null()) };
        if handle.is_null() {
            return Err(io::Error::last_os_error());
        }

        let mut info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        let result = unsafe {
            SetInformationJobObject(
                handle,
                JobObjectExtendedLimitInformation,
                std::ptr::addr_of!(info).cast(),
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            )
        };
        if result == 0 {
            let error = io::Error::last_os_error();
            unsafe {
                CloseHandle(handle);
            }
            return Err(error);
        }

        Ok(Self {
            handle: handle as usize,
        })
    }

    /// Assign a spawned child process to this job.
    pub fn assign(&self, child: &Child) -> io::Result<()> {
        let process_handle = child.as_raw_handle() as HANDLE;
        let result = unsafe { AssignProcessToJobObject(self.handle as HANDLE, process_handle) };
        if result == 0 {
            Err(io::Error::last_os_error())
        } else {
            Ok(())
        }
    }
}

impl Drop for ChildProcessJob {
    fn drop(&mut self) {
        unsafe {
            CloseHandle(self.handle as HANDLE);
        }
    }
}
