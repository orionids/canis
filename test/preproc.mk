include $(MK_TEMPLATE_ROOT)/symbol.mk
include $(MK_TEMPLATE)/def.mk

MK_DEP=$(MK_TEMPLATE)\dep.bat

all:
	$(MK_DEP) $(MK_DEVEL)/etc/canis/dep $(MK_DEVEL)/canis js $(AWS_OUT)/canis js
