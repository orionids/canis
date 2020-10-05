include $(MK_DEVEL)/etc/aws/key.cfg
include $(MK_DEVEL)/etc/aws/testcfg.cfg
include $(MK_DEVEL)/etc/canis.src
include $(MK_TEMPLATE_ROOT)/symbol.mk
EX_SRCPATH=$(MK_DEVEL)/canis/test

# env for batch command
BATCH=$(AWS_BATCH) $(MK_SETENV) LAMBDA_PREFIX=$(LAMBDA_PREFIX) $(MK_CONCATENATE) $(MK_SETENV) TABLE_PREFIX=$(TABLE_PREFIX)$(MK_CONCATENATE) $(MK_SETENV) stage=$(stage)$(MK_CONCATENATE)

# default run command for make run
MK_RUN=$(BATCH) $(NODE_RUN)

include $(MK_EXECUTE)

MK_RECURSIVE=$(foreach d,$(wildcard $(1:=/*)),$(call MK_RECURSIVE,$d,$2) $(filter $(subst *,%,$2),$d))

$(AWS_OUT)/%.py : $(MK_DEVEL)/%.py
	$(MK_DIRCREATE) $(call syspath,$(dir $@) $(MK_CONCATENATE) cp $< $@)

install: $(AWS_OUT)/mqtttest.zip

bbtable:
	$(BATCH) $(DYNAMODB_TABLE) $(TABLE_PREFIX)bblist 1 1 S userId S threadId
	$(BATCH) $(DYNAMODB_TABLE) $(TABLE_PREFIX)bb 1 1 S userId S threadId

$(AWS_OUT)/mqtttest.zip : $(AWS_OUT)/canis/test/lambda/mqtttest.py $(SHARED_ALL)
	$(AWS_LAMBDA) canis/test/lambda/mqtttest $(LAMBDA_PREFIX)mqtt-test --timeout 30 --memory-size 1024
	
