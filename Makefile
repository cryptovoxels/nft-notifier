check:
	doctl apps propose --spec app.yaml

create:
	doctl apps create --spec app.yaml

update:
	doctl apps update <insert-app-id> --spec app.yaml
