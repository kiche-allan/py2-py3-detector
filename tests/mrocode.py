class A(object):
    def identify(self):
        return "I am the Grandparent (A)"

class B(A):
    pass  # Inherits from A

class C(A):
    def identify(self):
        return "I am the Specialized Parent (C)"

class D(B, C):
    pass  # Inherits from B, then C
