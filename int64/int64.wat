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
    if ;; set carry if arg1.low > low
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
    ;; store the high part at address 40
    i64.store

    ;; copy the low part from the local to address 32
    i32.const 32
    get_local $low
    i64.store)
  (func (export "sub128")
        (local $borrow i64)
        (local $low i64)
    ;; clear the borrow
    i64.const 0
    set_local $borrow

    ;; location to store the high part
    i32.const 40

    ;; aubtract the two low parts
    i32.const 0
    i64.load
    i32.const 16
    i64.load
    i64.sub
    ;; save the low part in a local var
    set_local $low
    ;; compare the low part with arg0.low
    i32.const 0
    i64.load
    get_local $low
    i64.lt_u
    if ;; set borrow if arg1.low < low
      i64.const 1
      set_local $borrow
    end

    ;; subtract the two high parts - borrow
    i32.const 8
    i64.load
    i32.const 24
    i64.load
    i64.sub
    get_local $borrow
    i64.sub
    ;; store the high part at address 40
    i64.store

    ;; copy the low part from the local to address 32
    i32.const 32
    get_local $low
    i64.store)
  (func (export "neg128")
        (local $carry i64)
        (local $low_tmp i64)
        (local $low i64)
    ;; clear the carry
    i64.const 0
    set_local $carry

    ;; location to store the high part
    i32.const 40

    ;; add the two low parts
    i32.const 0
    i64.load
    i64.const 0xffffffffffffffff
    i64.xor
    set_local $low_tmp
    get_local $low_tmp
    i64.const 1
    i64.add
    ;; save the low part in a local var
    set_local $low
    ;; compare the low_tmp part with low
    get_local $low_tmp
    get_local $low
    i64.gt_u
    if ;; set carry if low_tmp > low
      i64.const 1
      set_local $carry
    end

    ;; add the two high parts + carry
    i32.const 8
    i64.load
    i64.const 0xffffffffffffffff
    i64.xor
    get_local $carry
    i64.add
    ;; store the high part at address 40
    i64.store

    ;; copy the low part from the local to address 32
    i32.const 32
    get_local $low
    i64.store)
  (func (export "not128")
    i32.const 32
    i32.const 0
    i64.load
    i64.const 0xffffffffffffffff
    i64.xor
    i64.store

    i32.const 40
    i32.const 8
    i64.load
    i64.const 0xffffffffffffffff
    i64.xor
    i64.store)
  (func (export "mul128")
        (local $r0 i64)
        (local $r1 i64)
        (local $r2 i64)
        (local $r3 i64)
        (local $tmp i64)
    ;; clear r2 and r3
    i64.const 0
    set_local $r2
    i64.const 0
    set_local $r3

    ;; Multiply a0*b0 store result in r0
    i32.const 0
    i64.load32_u
    i32.const 16
    i64.load32_u
    i64.mul
    set_local $r0

    ;; Multiply a0*b1 store result in r1
    i32.const 0
    i64.load32_u
    i32.const 20
    i64.load32_u
    i64.mul
    set_local $r1
    ;; Multiply a1*b0 add result to r1
    i32.const 4
    i64.load32_u
    i32.const 16
    i64.load32_u
    i64.mul
    set_local $tmp
    get_local $tmp
    get_local $r1
    i64.add
    set_local $r1
    ;; Check for r1 overflow
    get_local $tmp
    get_local $r1
    i64.gt_u
    if
      i64.const 0x100000000
      set_local $r2
    end

    ;; Multiply a0*b2 add result in r2
    i32.const 0
    i64.load32_u
    i32.const 24
    i64.load32_u
    i64.mul
    set_local $tmp
    get_local $tmp
    get_local $r2
    i64.add
    set_local $r2
    ;; Check for r2 overflow
    get_local $tmp
    get_local $r2
    i64.gt_u
    if
      i64.const 0x100000000
      set_local $r3
    end
    ;; Multiply a1*b1 add result to r2
    i32.const 4
    i64.load32_u
    i32.const 20
    i64.load32_u
    i64.mul
    set_local $tmp
    get_local $tmp
    get_local $r2
    i64.add
    set_local $r2
    ;; Check for r2 overflow
    get_local $tmp
    get_local $r2
    i64.gt_u
    if
      i64.const 0x100000000
      get_local $r3
      i64.add
      set_local $r3
    end
    ;; Multiply a2*b0 add result to r2
    i32.const 8
    i64.load32_u
    i32.const 16
    i64.load32_u
    i64.mul
    set_local $tmp
    get_local $tmp
    get_local $r2
    i64.add
    set_local $r2
    ;; Check for r2 overflow
    get_local $tmp
    get_local $r2
    i64.gt_u
    if
      i64.const 0x100000000
      get_local $r3
      i64.add
      set_local $r3
    end

    ;; Multiply a0*b3 add result in r3
    i32.const 0
    i64.load32_u
    i32.const 28
    i64.load32_u
    i64.mul
    get_local $r3
    i64.add
    set_local $r3
    ;; Multiply a1*b2 add result in r3
    i32.const 4
    i64.load32_u
    i32.const 24
    i64.load32_u
    i64.mul
    get_local $r3
    i64.add
    set_local $r3
    ;; Multiply a2*b1 add result in r3
    i32.const 8
    i64.load32_u
    i32.const 20
    i64.load32_u
    i64.mul
    get_local $r3
    i64.add
    set_local $r3
    ;; Multiply a3*b0 add result in r3
    i32.const 12
    i64.load32_u
    i32.const 16
    i64.load32_u
    i64.mul
    get_local $r3
    i64.add
    set_local $r3

    ;; store low 32 bit of r0 in the result
    i32.const 32
    get_local $r0
    i64.store32

    ;; add high 32 bits of r0 to r1 with carry
    get_local $r0
    i64.const 32
    i64.shr_u
    set_local $tmp
    get_local $tmp
    get_local $r1
    i64.add
    set_local $r1
    get_local $tmp
    get_local $r1
    i64.gt_u
    if
      ;; carry from r1 to r2
      i64.const 0x100000000
      get_local $r2
      i64.add
      set_local $r2
      i64.const 0x100000000
      get_local $r2
      i64.gt_u
      if
        ;; carry from r2 to r3
        i64.const 0x100000000
        get_local $r3
        i64.add
        set_local $r3
      end
    end

    ;; store low 32 bit of r1 in the result
    i32.const 36
    get_local $r1
    i64.store32

    ;; add high 32 bits of r1 to r2 with carry
    get_local $r1
    i64.const 32
    i64.shr_u
    set_local $tmp
    get_local $tmp
    get_local $r2
    i64.add
    set_local $r2
    get_local $tmp
    get_local $r2
    i64.gt_u
    if
      ;; carry from r2 to r3
      i64.const 0x100000000
      get_local $r3
      i64.add
      set_local $r3
    end

    ;; store low 32 bit of r2 in the result
    i32.const 40
    get_local $r2
    i64.store32

    ;; add high 32 bits of r2 to r3
    get_local $r2
    i64.const 32
    i64.shr_u
    get_local $r3
    i64.add
    set_local $r3

    ;; store low 32 bit of r3 in the result
    i32.const 44
    get_local $r3
    i64.store32)
)
