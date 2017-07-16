(module (memory (export "mem") 1)
  (func (export "add64")
    i32.const 32
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.add
    i64.store)
  (func (export "sub64")
    i32.const 32
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.sub
    i64.store)
  (func (export "mul64")
    i32.const 32
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.mul
    i64.store)
  (func (export "divs64")
    i32.const 32
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.div_s
    i64.store)
  (func (export "divu64")
    i32.const 32
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.div_u
    i64.store)
  (func (export "rems64")
    i32.const 32
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.rem_s
    i64.store)
  (func (export "remu64")
    i32.const 32
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.rem_u
    i64.store)
  (func (export "shl64")
    i32.const 32
    i32.const 0
    i64.load
    i32.const 8
    i64.load32_u
    i64.shl
    i64.store)
  (func (export "shrs64")
    i32.const 32
    i32.const 0
    i64.load
    i32.const 8
    i64.load32_u
    i64.shr_s
    i64.store)
  (func (export "shru64")
    i32.const 32
    i32.const 0
    i64.load
    i32.const 8
    i64.load32_u
    i64.shr_u
    i64.store)
  (func (export "rotl64")
    i32.const 32
    i32.const 0
    i64.load
    i32.const 8
    i64.load32_u
    i64.rotl
    i64.store)
  (func (export "rotr64")
    i32.const 32
    i32.const 0
    i64.load
    i32.const 8
    i64.load32_u
    i64.rotr
    i64.store)
  (func (export "clz64")
    i32.const 32
    i32.const 0
    i64.load
    i64.clz
    i64.store)
  (func (export "ctz64")
    i32.const 32
    i32.const 0
    i64.load
    i64.ctz
    i64.store)
  (func (export "lts64")
    i32.const 32
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.lt_s
    i32.store)
  (func (export "ltu64")
    i32.const 32
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.lt_u
    i32.store)
  (func (export "les64")
    i32.const 32
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.le_s
    i32.store)
  (func (export "leu64")
    i32.const 32
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.le_u
    i32.store)
  (func (export "gts64")
    i32.const 32
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.gt_s
    i32.store)
  (func (export "gtu64")
    i32.const 32
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.gt_u
    i32.store)
  (func (export "ges64")
    i32.const 32
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.ge_s
    i32.store)
  (func (export "geu64")
    i32.const 32
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.ge_u
    i32.store)
  (func (export "not64")
    i32.const 32
    i32.const 0
    i64.load
    i64.const 0xffffffffffffffff
    i64.xor
    i64.store)
  (func (export "neg64")
    i32.const 32
    i32.const 0
    i64.load
    i64.const 0xffffffffffffffff
    i64.xor
    i64.const 1
    i64.add
    i64.store)
  (func (export "add128") 
        (local $carry i64)
        (local $low i64)
    ;; clear the carry
    i64.const 0
    set_local $carry

    ;; location to store the high part
    i32.const 40

    ;; add the two low parts
    i32.const 0
    i64.load
    i32.const 16
    i64.load
    i64.add
    ;; save the low part in a local var
    set_local $low
    ;; compare the low part with arg0.low
    i32.const 0
    i64.load
    get_local $low
    i64.gt_u
    if ;; set carry it $low < arg1.low
      i64.const 1
      set_local $carry
    end

    ;; add the two high parts + carry
    i32.const 8
    i64.load
    i32.const 24
    i64.load
    i64.add
    get_local $carry
    i64.add
    ;; store the high part at address 48
    i64.store

    ;; copy the low part from the local to address 32
    i32.const 32
    get_local $low
    i64.store)
  (func (export "arg1_128")
    i32.const 40
    i32.const 8
    i64.load
    i64.store
    i32.const 32
    i32.const 0
    i64.load
    i64.store)
  (func (export "arg2_128")
    i32.const 40
    i32.const 24
    i64.load
    i64.store
    i32.const 32
    i32.const 16
    i64.load
    i64.store)
)