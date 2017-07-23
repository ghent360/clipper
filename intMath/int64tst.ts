/*
 * A library to perform precise integer math operations on 64 and 128-bit signed
 * numbers.
 * 
 * Copyright (c) 2017 Venelin Efremov
 * 
 * License:
 * Use, modification & distribution is subject to Boost Software License Ver 1.
 * http://www.boost.org/LICENSE_1_0.txt
 *
 */
import {Int64} from "./int64";

function int64Test() {
  console.log('int64 success');
  let a = Int64.fromNumber(0x100000000);
  let b = Int64.fromNumber(0x100000000);
  let c = a.add(b);
  console.log('c = 0x%s', c.toNumber().toString(16));
}

Int64.init().then(() => int64Test());