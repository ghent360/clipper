(module (memory (export "mem") 1)
  (func (export "add64")
    i32.const 16
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.add
    i64.store)
  (func (export "sub64")
    i32.const 16
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.sub
    i64.store)
  (func (export "mul64")
    i32.const 16
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.mul
    i64.store)
  (func (export "divs64")
    i32.const 16
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.div_s
    i64.store)
  (func (export "divu64")
    i32.const 16
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.div_u
    i64.store)
  (func (export "rems64")
    i32.const 16
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.rem_s
    i64.store)
  (func (export "remu64")
    i32.const 16
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.rem_u
    i64.store)
  (func (export "shl64")
    i32.const 16
    i32.const 0
    i64.load
    i32.const 8
    i64.load32_u
    i64.shl
    i64.store)
  (func (export "shrs64")
    i32.const 16
    i32.const 0
    i64.load
    i32.const 8
    i64.load32_u
    i64.shr_s
    i64.store)
  (func (export "shru64")
    i32.const 16
    i32.const 0
    i64.load
    i32.const 8
    i64.load32_u
    i64.shr_u
    i64.store)
  (func (export "rotl64")
    i32.const 16
    i32.const 0
    i64.load
    i32.const 8
    i64.load32_u
    i64.rotl
    i64.store)
  (func (export "rotr64")
    i32.const 16
    i32.const 0
    i64.load
    i32.const 8
    i64.load32_u
    i64.rotr
    i64.store)
  (func (export "clz64")
    i32.const 16
    i32.const 0
    i64.load
    i64.clz
    i64.store)
  (func (export "ctz64")
    i32.const 16
    i32.const 0
    i64.load
    i64.ctz
    i64.store)
  (func (export "lts64")
    i32.const 16
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.lt_s
    i32.store)
  (func (export "ltu64")
    i32.const 16
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.lt_u
    i32.store)
  (func (export "les64")
    i32.const 16
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.le_s
    i32.store)
  (func (export "leu64")
    i32.const 16
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.le_u
    i32.store)
  (func (export "gts64")
    i32.const 16
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.gt_s
    i32.store)
  (func (export "gtu64")
    i32.const 16
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.gt_u
    i32.store)
  (func (export "ges64")
    i32.const 16
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.ge_s
    i32.store)
  (func (export "geu64")
    i32.const 16
    i32.const 0
    i64.load
    i32.const 8
    i64.load
    i64.ge_u
    i32.store)
  (func (export "not64")
    i32.const 16
    i32.const 0
    i64.load
    i64.const 0xffffffffffffffff
    i64.xor
    i64.store)
  (func (export "neg64")
    i32.const 16
    i32.const 0
    i64.load
    i64.const 0xffffffffffffffff
    i64.xor
    i64.const 1
    i64.add
    i64.store)
)