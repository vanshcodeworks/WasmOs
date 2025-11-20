Now you can run in the terminal:

```bash
WasmOS $ proc list
WasmOS $ proc info math
WasmOS $ proc kill math
```

and show how “processes” (modules) appear, have memory usage, and can be “killed” (unloaded).

---

## 3) Improve `system memory` output to show sandboxing and per‑module usage

Right now `system memory` prints:

- total WASM allocations
- active allocations
- browser JS heap

Let’s extend it to list per‑module memory to visualize isolation.


Now when you:

1. Run some operations that write strings/arrays (e.g. `echo hello`, `str upper hello`, `math add 5 6`), and then
2. Execute:

```bash
WasmOS $ system memory
```

you’ll see **per‑module usage**, proving that each module has its own sandboxed linear memory where we track allocations.

This gives you concrete numbers to show in the report + screenshots for your presentation.

---

## 4) How to explain sandboxing & process management in your report

You can literally say:

- **Sandboxing test**:
  - We write data into each module’s linear memory via `writeString` / `writeArray`.
  - The `WasmMemoryManager` tracks allocations per module.
  - `system memory` and `proc list` show that:
    - Each module has its own allocation set.
    - There is no cross‑module memory sharing in user code.
  - This demonstrates **memory isolation** similar to OS process address spaces.

- **Process management mapping**:

  - “In WasmOS, each loaded WASM module is treated as a **logical process**.”
  - For each module we keep:
    - `pid`, `name`, `state (READY/RUNNING/TERMINATED)`, `loads`, `lastOp`, `memUsage`.
  - `proc list` is a **process table**.
  - `proc info <name>` is like `ps` / `top` detail.
  - `proc kill <name>` simulates process termination by unloading the module from cache.
  - The JS host acts as a **mini scheduler**, calling `module.call(...)`, tracking which process is `RUNNING`, then flipping back to `READY`.

That exactly ties into the OS theory bullets you listed:

- **Process creation** – first `loadModule(name)` → process entry created with PID.
- **Process isolation** – each module has its own linear memory, tracked per module.
- **Process states** – READY/RUNNING/TERMINATED flags.
- **Context switching** – when you call different module functions, the host is switching which module’s code/memory is active.
- **Execution model** – cooperative: WASM runs to completion per call; scheduler is in JS.

---

## 5) How to demo this to your evaluators

Suggested sequence:

1. Run some commands:

```bash
echo hello
math add 5 7
str upper wasmos
```

2. Show processes:

```bash
proc list
proc info math
```

3. Show memory:

```bash
system memory
```

4. Explain:

- “Each row in `proc list` is a WASM module acting as a process with its own sandboxed memory. We can terminate a module with `proc kill math` and the system will unload that WASM, simulating process termination.”

If you want, I can next add a **tiny “stress test” command** (e.g. `memtest`) that intentionally does several allocations via WASM to show increasing `memUsage` numbers in `system memory` and `proc list`.

Made changes.

# WasmOS Process Management & Sandboxing (Report Notes)

In WasmOS, **each WebAssembly module is treated as a logical process**:

- When `loadModule("math")` is called for the first time:
  - The JS host instantiates `math.wasm`.
  - A process table entry is created: `{ pid, name: "math", state: READY }`.
- When a command calls `math_add` or `math_factorial`:
  - The process state is temporarily set to `RUNNING`.
  - After completion, it returns to `READY`.
- When `proc kill math` is invoked:
  - The module is unloaded from the cache.
  - The process state transitions to `TERMINATED`.

**OS theory mapping:**

- Process creation → First module load
- Process isolation → Separate linear memory per module, no cross‑module pointers
- Process states → READY / RUNNING / TERMINATED flags tracked in JS
- Context switching → JS decides which module function to call next
- Execution model → Cooperative; each WASM call runs to completion

**Sandboxing test:**

1. Run a few commands that allocate memory inside modules:

   ```bash
   echo hello
   str upper wasmos
   math add 5 6
   ```

2. Inspect memory and processes:

   ```bash
   system memory
   proc list
   ```

3. Observe:

   - `system memory` shows **per‑module memory usage**.
   - `proc list` shows a process table with PID, state, mem(bytes), name.

This demonstrates that:

- Each module/process has its own allocation set.
- There is no shared mutable memory across modules.
- The host strictly controls when and how a module runs.

