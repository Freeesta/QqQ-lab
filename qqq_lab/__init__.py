"""Transitional alias: the package is now `mzlab`. `import qqq_lab.x` returns the very same module object as `mzlab.x`
(no duplicate modules, classes or caches). Kept only for code not yet updated (the encrypted TP Mine). Remove when nothing imports it."""
import importlib
import importlib.abc
import importlib.util
import sys

import mzlab as _pkg


class _Alias(importlib.abc.MetaPathFinder, importlib.abc.Loader):
    def find_spec(self, name, path=None, target=None):
        return importlib.util.spec_from_loader(name, self) if name.startswith("qqq_lab.") else None

    def create_module(self, spec):
        return importlib.import_module("mzlab" + spec.name[len("qqq_lab"):])

    def exec_module(self, module):
        pass


sys.meta_path.insert(0, _Alias())
sys.modules[__name__] = _pkg
